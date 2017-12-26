from binascii import a2b_base64

import base64

import urlparse

import json

import logging
from Crypto import Random
from Crypto.Cipher import PKCS1_OAEP
from Crypto.PublicKey import RSA
from Crypto.Util.asn1 import DerSequence
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.utils.translation import ugettext as _
from requests import HTTPError

from .media_service import (
    AssetDeliveryProtocol, AssetDeliveryPolicyConfigurationKey, AccessPolicyPermissions, AssetDeliveryPolicyType,
    ContentKeyType, KeyDeliveryType, MediaServiceClient, LocatorTypes
)

from .models import AzureOrgProfile


LOGGER = logging.getLogger(__name__)


def get_azure_config(organization):
    azure_profile = AzureOrgProfile.objects.filter(organization__short_name=organization).first()
    if azure_profile:
        azure_config = azure_profile.to_dict()
    elif all([
        settings.FEATURES.get('AZURE_CLIENT_ID'),
        settings.FEATURES.get('AZURE_CLIENT_SECRET'),
        settings.FEATURES.get('AZURE_TENANT'),
        settings.FEATURES.get('AZURE_REST_API_ENDPOINT'),
        settings.FEATURES.get('STORAGE_ACCOUNT_NAME'),
        settings.FEATURES.get('STORAGE_KEY')
    ]):
        azure_config = {
            'client_id': settings.FEATURES.get('AZURE_CLIENT_ID'),
            'secret': settings.FEATURES.get('AZURE_CLIENT_SECRET'),
            'tenant': settings.FEATURES.get('AZURE_TENANT'),
            'rest_api_endpoint': settings.FEATURES.get('AZURE_REST_API_ENDPOINT'),
            'storage_account_name': settings.FEATURES.get('STORAGE_ACCOUNT_NAME'),
            'storage_key': settings.FEATURES.get('STORAGE_KEY')
        }
    else:
        raise ImproperlyConfigured(_(
            'In order to use Azure storage for Video Uploads one of the followings must be configured: '
            '"Azure organization profile" for certain Organization or global CMS settings. '
            'All settings are mandatory: "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET", "AZURE_TENANT", '
            '"AZURE_REST_API_ENDPOINT", "STORAGE_ACCOUNT_NAME", "STORAGE_KEY".'
        ))
    return azure_config


def get_media_service_client(organization):
    return MediaServiceClient(get_azure_config(organization))


def encrypt_file(video_id, organization):
    """
    AES open.
    Associate an encryption key (EnvelopeEncryption) with the asset and
    configure authorization policies for the key open.
    """
    media_service = get_media_service_client(organization)
    asset = media_service.get_input_asset_by_video_id(video_id, "ENCODED")

    if not asset:
        return 'file_corrupt'

    content_key = media_service.get_asset_content_keys(asset['Id'], ContentKeyType.ENVELOPE_ENCRYPTION)

    try:
        remove_access_policies_and_locators(media_service, asset)

        if content_key is None:
            content_key = create_content_key_and_associate_with_encoded_asset(media_service, asset)
            create_authorization_policy_and_associate_with_content_key(media_service, content_key)

        create_delivery_policy_and_associate_with_encoded_asset(media_service, asset, content_key)
        create_access_policies_and_locators(media_service, asset)
    except HTTPError as er:
        LOGGER.info('Video id - {} encryption error: {}'.format(video_id, er))
        return 'encryption_error'

    return 'file_encrypted'


def remove_encryption(video_id, organization):
    media_service = get_media_service_client(organization)
    asset = media_service.get_input_asset_by_video_id(video_id, "ENCODED")

    if not asset:
        return 'file_corrupt'

    try:
        remove_access_policies_and_locators(media_service, asset)
        remove_delivery_policy_link_from_asset_and_delivery_policy(media_service, asset)
        create_access_policies_and_locators(media_service, asset)
    except HTTPError as er:
        LOGGER.info('Video id - {} decryption error: {}'.format(video_id, er))
        return 'decryption_error'

    return 'file_complete'


def remove_access_policies_and_locators(media_service, asset):
    locators = media_service.get_asset_locators(asset['Id'])
    for locator in locators:
        if locator['AccessPolicyId']:
            media_service.delete_access_policy(locator['AccessPolicyId'])
        media_service.delete_locator(locator["Id"])


def create_content_key_and_associate_with_encoded_asset(media_service, asset):
    protection_key_id = media_service.get_protection_key_id(ContentKeyType.ENVELOPE_ENCRYPTION)
    protection_key = media_service.get_protection_key(protection_key_id)
    _, encrypted_content_key = encrypt_content_key_with_public_key(protection_key)
    content_key = media_service.create_content_key(
        'ContentKey {}'.format(asset['Name']),
        protection_key_id,
        ContentKeyType.ENVELOPE_ENCRYPTION,
        encrypted_content_key
    )
    media_service.associate_content_key_with_asset(asset['Id'], content_key['Id'])
    return content_key


def create_authorization_policy_and_associate_with_content_key(media_service, content_key):
    authorization_policy = media_service.create_content_key_authorization_policy(
        'Open Authorization Policy {}'.format(content_key['Name'])
    )
    authorization_policy_option = media_service.create_content_key_open_authorization_policy_options(
        'Authorization policy option',
        KeyDeliveryType.BASE_LINE_HTTP
    )
    media_service.associate_authorization_policy_with_option(
        authorization_policy['Id'],
        authorization_policy_option['Id']
    )
    media_service.update_content_key(
        content_key["Id"],
        data={"AuthorizationPolicyId": authorization_policy['Id']}
    )


def create_delivery_policy_and_associate_with_encoded_asset(media_service, asset, content_key):
    key_delivery_url = media_service.get_key_delivery_url(
        content_key['Id'],
        KeyDeliveryType.BASE_LINE_HTTP
    )
    asset_delivery_configuration = [{
        "Key": AssetDeliveryPolicyConfigurationKey.ENVELOPE_BASE_KEY_ACQUISITION_URL,
        "Value": urlparse.urljoin(key_delivery_url, urlparse.urlparse(key_delivery_url).path)
    }]
    asset_delivery_policy = media_service.create_asset_delivery_policy(
        'AssetDeliveryPolicy {}'.format(asset['Name']),
        AssetDeliveryProtocol.ALL,
        AssetDeliveryPolicyType.DYNAMIC_ENVELOPE_ENCRYPTION,
        json.dumps(asset_delivery_configuration)
    )
    media_service.associate_delivery_polic_with_asset(asset['Id'], asset_delivery_policy['Id'])


def create_access_policies_and_locators(media_service, asset):
    policy_name = u'OpenEdxVideoPipelineAccessPolicy'
    access_policy = media_service.create_access_policy(
        policy_name,
        duration_in_minutes=60 * 24 * 365 * 10,
        permissions=AccessPolicyPermissions.READ
    )
    media_service.create_locator(
        access_policy['Id'],
        asset['Id'],
        locator_type=LocatorTypes.OnDemandOrigin
    )
    media_service.create_locator(
        access_policy['Id'],
        asset['Id'],
        locator_type=LocatorTypes.SAS
    )


def remove_delivery_policy_link_from_asset_and_delivery_policy(media_service, asset):
    delivery_policies = media_service.get_asset_delivery_policies(asset['Id'])
    for delivery_policy in delivery_policies:
        media_service.delete_delivery_policy_link_from_asset(asset['Id'], delivery_policy["Id"])
        media_service.delete_delivery_policy(delivery_policy["Id"])


def encrypt_content_key_with_public_key(protection_key):
    # Extract subjectPublicKeyInfo field from X.509 certificate
    der = a2b_base64(protection_key)
    cert = DerSequence()
    cert.decode(der)
    tbsCertificate = DerSequence()
    tbsCertificate.decode(cert[0])
    subjectPublicKeyInfo = tbsCertificate[6]

    # Initialize RSA key
    rsa_key = RSA.importKey(subjectPublicKeyInfo)
    cipherrsa = PKCS1_OAEP.new(rsa_key)

    # Randomly generate a 16-byte key for common and envelope encryption
    content_key = Random.new().read(16)
    encrypted_content_key = cipherrsa.encrypt(content_key)
    return content_key, base64.b64encode(encrypted_content_key)

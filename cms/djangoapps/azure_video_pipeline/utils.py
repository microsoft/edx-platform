import base64
import json
import logging
import urlparse
from binascii import a2b_base64

from Crypto import Random
from Crypto.Cipher import PKCS1_OAEP
from Crypto.PublicKey import RSA
from Crypto.Util.asn1 import DerSequence
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.utils.translation import ugettext as _
from requests import HTTPError

from .media_service import (
    MediaServiceClient,
    ContentKeyType,
    KeyDeliveryType, AssetDeliveryPolicyConfigurationKey, AssetDeliveryProtocol, AssetDeliveryPolicyType,
    AccessPolicyPermissions, LocatorTypes)
from .models import AzureOrgProfile

LOGGER = logging.getLogger(__name__)


def get_azure_config(organization):
    azure_profile = AzureOrgProfile.objects.filter(organization__short_name=organization).first()
    if azure_profile:
        azure_config = azure_profile.to_dict()
    elif all([
        settings.AZURE_CLIENT_ID,
        settings.AZURE_CLIENT_SECRET,
        settings.AZURE_TENANT,
        settings.AZURE_REST_API_ENDPOINT,
        settings.AZURE_STORAGE_ACCOUNT_NAME,
        settings.AZURE_STORAGE_KEY
    ]):
        azure_config = {
            'client_id': settings.AZURE_CLIENT_ID,
            'secret': settings.AZURE_CLIENT_SECRET,
            'tenant': settings.AZURE_TENANT,
            'rest_api_endpoint': settings.AZURE_REST_API_ENDPOINT,
            'storage_account_name': settings.AZURE_STORAGE_ACCOUNT_NAME,
            'storage_key': settings.AZURE_STORAGE_KEY
        }
    else:
        raise ImproperlyConfigured(_(
            'In order to use Azure storage for Video Uploads one of the followings must be configured: '
            '"Azure organization profile" for certain Organization or global CMS settings. '
            'All settings are mandatory: "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET", "AZURE_TENANT", '
            '"AZURE_REST_API_ENDPOINT", "AZURE_STORAGE_ACCOUNT_NAME", "AZURE_STORAGE_KEY".'
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
    media_service_client = get_media_service_client(organization)
    asset = media_service_client.get_input_asset_by_video_id(video_id, "ENCODED")

    if not asset:
        return 'file_corrupt'

    content_key = media_service_client.get_asset_content_keys(asset['Id'], ContentKeyType.ENVELOPE_ENCRYPTION)

    try:
        remove_access_policies_and_locators(media_service_client, asset)

        if content_key is None:
            content_key = create_content_key_and_associate_with_encoded_asset(media_service_client, asset)
            create_authorization_policy_and_associate_with_content_key(media_service_client, content_key)

        create_delivery_policy_and_associate_with_encoded_asset(media_service_client, asset, content_key)
        create_access_policies_and_locators(media_service_client, asset)
    except HTTPError as er:
        LOGGER.info('Video id - {} encryption error: {}'.format(video_id, er))
        return 'encryption_error'

    return 'file_encrypted'


def remove_encryption(video_id, organization):
    media_service_client = get_media_service_client(organization)
    asset = media_service_client.get_input_asset_by_video_id(video_id, "ENCODED")

    if not asset:
        return 'file_corrupt'

    try:
        remove_access_policies_and_locators(media_service_client, asset)
        remove_delivery_policy_link_from_asset_and_delivery_policy(media_service_client, asset)
        create_access_policies_and_locators(media_service_client, asset)
    except HTTPError as er:
        LOGGER.info('Video id - {} decryption error: {}'.format(video_id, er))
        return 'decryption_error'

    return 'file_complete'


def remove_access_policies_and_locators(media_service_client, asset):
    locators = media_service_client.get_asset_locators(asset['Id'])
    for locator in locators:
        if locator['AccessPolicyId']:
            media_service_client.delete_access_policy(locator['AccessPolicyId'])
        media_service_client.delete_locator(locator["Id"])


def create_content_key_and_associate_with_encoded_asset(media_service_client, asset):
    protection_key_id = media_service_client.get_protection_key_id(ContentKeyType.ENVELOPE_ENCRYPTION)
    protection_key = media_service_client.get_protection_key(protection_key_id)
    _, encrypted_content_key = encrypt_content_key_with_public_key(protection_key)
    content_key = media_service_client.create_content_key(
        'ContentKey {}'.format(asset['Name']),
        protection_key_id,
        ContentKeyType.ENVELOPE_ENCRYPTION,
        encrypted_content_key
    )
    media_service_client.associate_content_key_with_asset(asset['Id'], content_key['Id'])
    return content_key


def create_authorization_policy_and_associate_with_content_key(media_service_client, content_key):
    authorization_policy = media_service_client.create_content_key_authorization_policy(
        'Open Authorization Policy {}'.format(content_key['Name'])
    )
    authorization_policy_option = media_service_client.create_content_key_open_authorization_policy_options(
        'Authorization policy option',
        KeyDeliveryType.BASE_LINE_HTTP
    )
    media_service_client.associate_authorization_policy_with_option(
        authorization_policy['Id'],
        authorization_policy_option['Id']
    )
    media_service_client.update_content_key(
        content_key["Id"],
        data={"AuthorizationPolicyId": authorization_policy['Id']}
    )


def create_delivery_policy_and_associate_with_encoded_asset(media_service_client, asset, content_key):
    key_delivery_url = media_service_client.get_key_delivery_url(
        content_key['Id'],
        KeyDeliveryType.BASE_LINE_HTTP
    )
    asset_delivery_configuration = [{
        "Key": AssetDeliveryPolicyConfigurationKey.ENVELOPE_BASE_KEY_ACQUISITION_URL,
        "Value": urlparse.urljoin(key_delivery_url, urlparse.urlparse(key_delivery_url).path)
    }]
    asset_delivery_policy = media_service_client.create_asset_delivery_policy(
        'AssetDeliveryPolicy {}'.format(asset['Name']),
        AssetDeliveryProtocol.ALL,
        AssetDeliveryPolicyType.DYNAMIC_ENVELOPE_ENCRYPTION,
        json.dumps(asset_delivery_configuration)
    )
    media_service_client.associate_delivery_polic_with_asset(asset['Id'], asset_delivery_policy['Id'])


def create_access_policies_and_locators(media_service_client, asset):
    policy_name = u'OpenEdxVideoPipelineAccessPolicy'
    access_policy = media_service_client.create_access_policy(
        policy_name,
        duration_in_minutes=60 * 24 * 365 * 10,
        permissions=AccessPolicyPermissions.READ
    )
    media_service_client.create_locator(
        access_policy['Id'],
        asset['Id'],
        locator_type=LocatorTypes.OnDemandOrigin
    )
    media_service_client.create_locator(
        access_policy['Id'],
        asset['Id'],
        locator_type=LocatorTypes.SAS
    )


def remove_delivery_policy_link_from_asset_and_delivery_policy(media_service_client, asset):
    delivery_policies = media_service_client.get_asset_delivery_policies(asset['Id'])
    for delivery_policy in delivery_policies:
        media_service_client.delete_delivery_policy_link_from_asset(asset['Id'], delivery_policy["Id"])
        media_service_client.delete_delivery_policy(delivery_policy["Id"])


def encrypt_content_key_with_public_key(protection_key):
    # Extract subjectPublicKeyInfo field from X.509 certificate
    der = a2b_base64(protection_key)
    cert = DerSequence()
    cert.decode(der)
    tbs_certificate = DerSequence()
    tbs_certificate.decode(cert[0])
    subject_public_key_info = tbs_certificate[6]

    # Initialize RSA key
    rsa_key = RSA.importKey(subject_public_key_info)
    cipherrsa = PKCS1_OAEP.new(rsa_key)

    # Randomly generate a 16-byte key for common and envelope encryption
    content_key = Random.new().read(16)
    encrypted_content_key = cipherrsa.encrypt(content_key)
    return content_key, base64.b64encode(encrypted_content_key)

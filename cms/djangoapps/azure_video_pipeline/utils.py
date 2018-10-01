# -*- coding: utf-8 -*-
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
from edxval.models import Video
from requests import HTTPError

from .media_service import (
    MediaServiceClient,
    ContentKeyType,
    KeyDeliveryType, AssetDeliveryPolicyConfigurationKey, AssetDeliveryProtocol, AssetDeliveryPolicyType,
    AccessPolicyPermissions, LocatorTypes)
from .models import AzureOrgProfile

LOGGER = logging.getLogger(__name__)


AZURE_TRANSCRIPT_FILE_FORMAT = 'vtt'


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


def get_transcript_file_name(video, language_code):
    return "{}_{}.{}".format(
        video.client_video_id.split('.')[0][:20],
        language_code,
        AZURE_TRANSCRIPT_FILE_FORMAT
    )


def get_captions_info(video, path_locator_sas):
    data = []
    if path_locator_sas:
        for transcript in video.video_transcripts.all():
            language_code = transcript.language_code
            file_name = get_transcript_file_name(video, language_code)
            data.append({
                'download_url': '/{}?'.format(file_name).join(path_locator_sas.split('?')),
                'file_name': file_name,
                'language': language_code,
                'language_title': dict(ALL_LANGUAGES_FOR_MICROSOFT).get(language_code, language_code),
                'id': transcript.id
            })
    return data


def get_video_info(video, path_locator_on_demand, path_locator_sas, asset_files):
    download_video_url = ''

    if path_locator_sas and video.status == 'file_complete':
        file_size = 0
        for asset_file in asset_files:
            try:
                content_file_size = int(asset_file.get('ContentFileSize', 0))
            except ValueError:
                content_file_size = 0

            if asset_file.get('Name', '').endswith('.mp4') and content_file_size > file_size:
                name_file = asset_file['Name']
                file_size = content_file_size
                download_video_url = u'/{}?'.format(name_file).join(path_locator_sas.split('?'))

    return {
        'smooth_streaming_url': u'{}{}/manifest'.format(
            path_locator_on_demand, video.client_video_id.replace('mp4', 'ism')
        ) if path_locator_on_demand else '',
        'download_video_url': download_video_url,
    }


def _drop_http_or_https(url):
    """
    In order to avoid mixing HTTP/HTTPS which can cause some warnings to appear in some browsers.
    """
    return url.replace("https:", "").replace("http:", "")


def get_captions_and_video_info(edx_video_id, organization):
    """
    Gather Azure locators for video and captions by given edx_video_id and Organization.

    :param edx_video_id:
    :param organization:
    :return: (dict)
    """
    error_message = _("Target Video is no longer available on Azure or is corrupted in some way.")
    captions = []
    video_info = {}
    asset_files = None

    try:
        video = Video.objects.get(edx_video_id=edx_video_id)
    except Video.DoesNotExist:
        asset = None
        LOGGER.exception('There is no Video with such video ID!')
    else:
        media_service_client = get_media_service_client(organization)
        asset = media_service_client.get_input_asset_by_video_id(edx_video_id, 'ENCODED')

    if asset:
        locator_on_demand = media_service_client.get_asset_locators(asset['Id'], LocatorTypes.OnDemandOrigin)
        locator_sas = media_service_client.get_asset_locators(asset['Id'], LocatorTypes.SAS)

        if locator_on_demand:
            error_message = ''
            path_locator_on_demand = _drop_http_or_https(locator_on_demand.get('Path'))
            path_locator_sas = None

            if locator_sas:
                path_locator_sas = _drop_http_or_https(locator_sas.get('Path'))
                captions = get_captions_info(video, path_locator_sas)
                asset_files = media_service_client.get_asset_files(asset['Id'])
            else:
                error_message = _("To be able to use captions/transcripts auto-fetching, "
                                  "AMS Asset should be published properly "
                                  "(in addition to 'streaming' locator a 'progressive' "
                                  "locator must be created as well).")

            video_info = get_video_info(video, path_locator_on_demand, path_locator_sas, asset_files)

    return {'error_message': error_message,
            'video_info': video_info,
            'captions': captions}


ALL_LANGUAGES_FOR_MICROSOFT = (
    [u"aa", u"Afar"],
    [u"af", u"Afrikaans"],
    [u"agq", u"Aghem"],
    [u"ak", u"Akan"],
    [u"sq", u"Albanian"],
    [u"am", u"Amharic"],
    [u"ar", u"Arabic"],
    [u"arz", u"Arabic, Egyptian"],
    [u"afb", u"Arabic, Gulf"],
    [u"apc", u"Arabic, Levantine"],
    [u"hy", u"Armenian"],
    [u"as", u"Assamese"],
    [u"ast", u"Asturian"],
    [u"asa", u"Asu"],
    [u"az-Cyrl", u"Azerbaijani (Cyrillic)"],
    [u"az-Latn", u"Azerbaijani (Latin)"],
    [u"ksf", u"Bafia"],
    [u"bm-Latn", u"Bamanankan (Latin)"],
    [u"bn", u"Bangla"],
    [u"bas", u"Basaa"],
    [u"ba", u"Bashkir"],
    [u"eu", u"Basque"],
    [u"be", u"Belarusian"],
    [u"bem", u"Bemba"],
    [u"bez", u"Bena"],
    [u"byn", u"Blin"],
    [u"brx", u"Bodo"],
    [u"bs-Cyrl", u"Bosnian (Cyrillic)"],
    [u"bs-Latn", u"Bosnian (Latin)"],
    [u"br", u"Breton"],
    [u"bg", u"Bulgarian"],
    [u"my", u"Burmese"],
    [u"yue-Hant", u"Cantonese (Traditional)"],
    [u"ca", u"Catalan"],
    [u"ceb", u"Cebuano"],
    [u"tzm-Arab", u"Central Atlas Tamazight (Arabic)"],
    [u"tzm-Latn", u"Central Atlas Tamazight (Latin)"],
    [u"tzm-Tfng", u"Central Atlas Tamazight (Tifinagh)"],
    [u"ku-Arab", u"Central Kurdish"],
    [u"ce", u"Chechen"],
    [u"chr-Cher", u"Cherokee (Cherokee)"],
    [u"cgg", u"Chiga"],
    [u"zh-Hans", u"Chinese (Simplified)"],
    [u"zh-Hant", u"Chinese (Traditional)"],
    [u"cu", u"Church Slavic"],
    [u"ksh", u"Colognian"],
    [u"swc", u"Congo Swahili"],
    [u"kw", u"Cornish"],
    [u"co", u"Corsican"],
    [u"hr", u"Croatian"],
    [u"cs", u"Czech"],
    [u"da", u"Danish"],
    [u"prs", u"Dari"],
    [u"dv", u"Divehi"],
    [u"dgo", u"Dogri"],
    [u"dua", u"Duala"],
    [u"nl", u"Dutch"],
    [u"dz", u"Dzongkha"],
    [u"bin", u"Edo"],
    [u"ebu", u"Embu"],
    [u"en", u"English"],
    [u"eo", u"Esperanto"],
    [u"et", u"Estonian"],
    [u"ee", u"Ewe"],
    [u"ewo", u"Ewondo"],
    [u"fo", u"Faroese"],
    [u"fj", u"Fijian"],
    [u"fil", u"Filipino"],
    [u"fi", u"Finnish"],
    [u"fr", u"French"],
    [u"fur", u"Friulian"],
    [u"ff-Latn", u"Fulah"],
    [u"gl", u"Galician"],
    [u"lg", u"Ganda"],
    [u"ka", u"Georgian"],
    [u"de", u"German"],
    [u"el", u"Greek"],
    [u"kl", u"Greenlandic"],
    [u"gn", u"Guarani"],
    [u"gu", u"Gujarati"],
    [u"guz", u"Gusii"],
    [u"ht", u"Haitian"],
    [u"ha-Latn", u"Hausa (Latin)"],
    [u"haw", u"Hawaiian"],
    [u"he", u"Hebrew"],
    [u"hi", u"Hindi"],
    [u"mww", u"Hmong Daw"],
    [u"hu", u"Hungarian"],
    [u"is", u"Icelandic"],
    [u"ig", u"Igbo"],
    [u"smn", u"Inari Sami"],
    [u"id", u"Indonesian"],
    [u"ia", u"Interlingua"],
    [u"iu-Cans", u"Inuktitut (Canadian Aboriginal Syllabics)"],
    [u"iu-Latn", u"Inuktitut (Latin)"],
    [u"iv", u"Invariant Language"],
    [u"ga", u"Irish"],
    [u"xh", u"isiXhosa"],
    [u"zu", u"isiZulu"],
    [u"it", u"Italian"],
    [u"ja", u"Japanese"],
    [u"jv-Latn", u"Javanese (Latin)"],
    [u"dyo", u"Jola-Fonyi"],
    [u"quc", u"K'iche'"],
    [u"kea", u"Kabuverdianu"],
    [u"kab", u"Kabyle"],
    [u"kkj", u"Kako"],
    [u"kln", u"Kalenjin"],
    [u"kam", u"Kamba"],
    [u"kr", u"Kanuri"],
    [u"ks-Deva", u"Kashmiri (Devanagari)"],
    [u"ks-Arab", u"Kashmiri (Perso-Arabic)"],
    [u"kk", u"Kazakh"],
    [u"km", u"Khmer"],
    [u"ki", u"Kikuyu"],
    [u"rw", u"Kinyarwanda"],
    [u"sw", u"Kiswahili"],
    [u"kok", u"Konkani"],
    [u"ko", u"Korean"],
    [u"khq", u"Koyra Chiini"],
    [u"ses", u"Koyraboro Senni"],
    [u"kfr", u"Kutchi"],
    [u"nmg", u"Kwasio"],
    [u"ky", u"Kyrgyz"],
    [u"lkt", u"Lakota"],
    [u"lag", u"Langi"],
    [u"lo", u"Lao"],
    [u"lv", u"Latvian"],
    [u"ln", u"Lingala"],
    [u"lt", u"Lithuanian"],
    [u"nds", u"Low German"],
    [u"dsb", u"Lower Sorbian"],
    [u"lu", u"Luba-Katanga"],
    [u"smj", u"Lule Sami"],
    [u"luo", u"Luo"],
    [u"lb", u"Luxembourgish"],
    [u"luy", u"Luyia"],
    [u"mk", u"Macedonian"],
    [u"jmc", u"Machame"],
    [u"mai", u"Maithili"],
    [u"mgh", u"Makhuwa-Meetto"],
    [u"kde", u"Makonde"],
    [u"mg", u"Malagasy"],
    [u"ms", u"Malay (Latin)"],
    [u"ml", u"Malayalam"],
    [u"mt", u"Maltese"],
    [u"mni", u"Manipuri"],
    [u"gv", u"Manx"],
    [u"mi", u"Maori"],
    [u"arn", u"Mapudungun"],
    [u"mr", u"Marathi"],
    [u"mas", u"Masai"],
    [u"mzn", u"Mazanderani"],
    [u"mer", u"Meru"],
    [u"mgo", u"Meta'"],
    [u"moh", u"Mohawk"],
    [u"mn-Cyrl", u"Mongolian (Cyrillic)"],
    [u"mn-Mong", u"Mongolian (Traditional Mongolian)"],
    [u"cnr-Cyrl", u"Montenegrin (Cyrillic)"],
    [u"cnr-Latn", u"Montenegrin (Latin)"],
    [u"mfe", u"Morisyen"],
    [u"mua", u"Mundang"],
    [u"nqo", u"N'Ko"],
    [u"naq", u"Nama"],
    [u"ne", u"Nepali"],
    [u"nnh", u"Ngiemboon"],
    [u"jgo", u"Ngomba"],
    [u"nd", u"North Ndebele"],
    [u"kmr-Arab", u"Northern Kurdish (Arabic)"],
    [u"lrc", u"Northern Luri"],
    [u"se", u"Northern Sami"],
    [u"nb", u"Norwegian Bokmål"],
    [u"nn", u"Norwegian Nynorsk"],
    [u"nus", u"Nuer"],
    [u"nyn", u"Nyankole"],
    [u"oc", u"Occitan"],
    [u"or", u"Odia"],
    [u"om", u"Oromo"],
    [u"os-Cyrl", u"Ossetic (Cyrillic)"],
    [u"os-Latn", u"Ossetic (Latin)"],
    [u"pap", u"Papiamento"],
    [u"fa", u"Persian"],
    [u"pl", u"Polish"],
    [u"pt", u"Portuguese"],
    [u"pt-BR", u"Portuguese (Brazil)"],
    [u"pt-PT", u"Portuguese (Portugal)"],
    [u"prg", u"Prussian"],
    [u"qps", u"Pseudo"],
    [u"pa-Arab", u"Punjabi (Arabic)"],
    [u"pa-Guru", u"Punjabi (Gurmukhi)"],
    [u"quz", u"Quechua"],
    [u"otq", u"Querétaro Otomi"],
    [u"ro", u"Romanian"],
    [u"rof", u"Rombo"],
    [u"rn", u"Rundi"],
    [u"ru", u"Russian"],
    [u"rwk", u"Rwa"],
    [u"ssy", u"Saho"],
    [u"sah", u"Sakha"],
    [u"saq", u"Samburu"],
    [u"sm", u"Samoan"],
    [u"sg", u"Sango"],
    [u"sbp", u"Sangu"],
    [u"sa", u"Sanskrit"],
    [u"sat-Deva", u"Santali (Devanagari)"],
    [u"gd", u"Scottish Gaelic"],
    [u"seh", u"Sena"],
    [u"sr-Cyrl", u"Serbian (Cyrillic)"],
    [u"sr-Latn", u"Serbian (Latin)"],
    [u"st", u"Sesotho"],
    [u"nso", u"Sesotho sa Leboa"],
    [u"tn", u"Setswana"],
    [u"ksb", u"Shambala"],
    [u"sn", u"Shona"],
    [u"sd-Arab", u"Sindhi (Arabic)"],
    [u"sd-Deva", u"Sindhi (Devanagari)"],
    [u"si", u"Sinhala"],
    [u"ss", u"siSwati"],
    [u"sms", u"Skolt Sami"],
    [u"sk", u"Slovak"],
    [u"sl", u"Slovenian"],
    [u"xog", u"Soga"],
    [u"so", u"Somali"],
    [u"nr", u"South Ndebele"],
    [u"sma", u"Southern Sami"],
    [u"es", u"Spanish"],
    [u"zgh-Tfng", u"Standard Moroccan Tamazight (Tifinagh)"],
    [u"sv", u"Swedish"],
    [u"gsw", u"Swiss German"],
    [u"syr", u"Syriac"],
    [u"shi-Latn", u"Tachelhit (Latin)"],
    [u"shi-Tfng", u"Tachelhit (Tifinagh)"],
    [u"ty", u"Tahitian"],
    [u"dav", u"Taita"],
    [u"tg-Cyrl", u"Tajik (Cyrillic)"],
    [u"ta", u"Tamil"],
    [u"twq", u"Tasawaq"],
    [u"tt-Cyrl", u"Tatar (Cyrillic)"],
    [u"te", u"Telugu"],
    [u"teo", u"Teso"],
    [u"th", u"Thai"],
    [u"bo", u"Tibetan"],
    [u"tig", u"Tigre"],
    [u"ti", u"Tigrinya"],
    [u"to", u"Tongan"],
    [u"tr", u"Turkish"],
    [u"tk-Latn", u"Turkmen (Latin)"],
    [u"uk", u"Ukrainian"],
    [u"hsb", u"Upper Sorbian"],
    [u"ur", u"Urdu"],
    [u"ug-Arab", u"Uyghur (Arabic)"],
    [u"uz-Cyrl", u"Uzbek (Cyrillic)"],
    [u"uz-Latn", u"Uzbek (Latin)"],
    [u"uz-Arab", u"Uzbek (Perso-Arabic)"],
    [u"vai-Latn", u"Vai (Latin)"],
    [u"vai-Vaii", u"Vai (Vai)"],
    [u"ca-ES-valencia", u"Valencian"],
    [u"ve", u"Venda"],
    [u"vi", u"Vietnamese"],
    [u"vo", u"Volapük"],
    [u"vun", u"Vunjo"],
    [u"wae", u"Walser"],
    [u"cy", u"Welsh"],
    [u"fy", u"Western Frisian"],
    [u"wal", u"Wolaytta"],
    [u"wo", u"Wolof"],
    [u"ts", u"Xitsonga"],
    [u"yav", u"Yangben"],
    [u"ii", u"Yi"],
    [u"yi", u"Yiddish"],
    [u"yo", u"Yoruba"],
    [u"yua", u"Yucatec Maya"],
    [u"dje", u"Zarma"],
    [u"dje", u"Zarma"]
)

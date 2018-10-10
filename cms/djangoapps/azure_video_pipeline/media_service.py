from datetime import datetime, timedelta
import logging
import mimetypes
import re
import requests

from msrestazure.azure_active_directory import ServicePrincipalCredentials

from .blobs_service import BlobServiceClient


LOGGER = logging.getLogger(__name__)


class AccessPolicyPermissions(object):
    NONE = 0
    READ = 1
    WRITE = 2
    DELETE = 3


class LocatorTypes(object):
    SAS = 1
    OnDemandOrigin = 2


class ContentKeyType(object):
    COMMON_ENCRYPTION = 0
    STORAGE_ENCRYPTION = 1
    CONFIGURATION_ENCRYPTION = 2
    ENVELOPE_ENCRYPTION = 4


class KeyRestrictionType(object):
    OPEN = 0
    TOKEN_RESTRICTED = 1
    IP_RESTRICTED = 2


class KeyDeliveryType(object):
    NONE = 0
    PLAY_READY_LICENSE = 1
    BASE_LINE_HTTP = 2


class AssetDeliveryPolicyConfigurationKey(object):
    NONE = 0
    ENVELOPE_KEY_ACQUISITION_URL = 1
    ENVELOPE_BASE_KEY_ACQUISITION_URL = 2


class AssetDeliveryProtocol(object):
    NONE = 0
    SMOOTH_STREAMING = 1
    DASH = 2
    HLS = 4
    ALL = 7


class AssetDeliveryPolicyType(object):
    NONE = 0
    BLOCKED = 1
    NO_DYNAMIC_ENCRYPTION = 2
    DYNAMIC_ENVELOPE_ENCRYPTION = 3
    DYNAMIC_COMMON_ENCRYPTION = 4


class MediaServiceClient(object):
    """
    Client to consume Azure Media service API.
    """

    RESOURCE = 'https://rest.media.azure.net'

    def __init__(self, azure_config):
        """
        Create a MediaServiceClient instance.

        :param azure_config: (dict) initialization parameters
        """
        self.rest_api_endpoint = azure_config.get('rest_api_endpoint')
        self.storage_account_name = azure_config.get('storage_account_name')
        self.storage_key = azure_config.get('storage_key')
        host = re.findall('[https|http]://(\w+.+)/api/', self.rest_api_endpoint, re.M)
        self.host = host[0] if host else None
        self.credentials = ServicePrincipalCredentials(resource=self.RESOURCE, **azure_config)
        self.asset = {}
        self.client_video_id = ''

    def get_headers(self):
        return {
            'Content-Type': 'application/json',
            'DataServiceVersion': '1.0',
            'MaxDataServiceVersion': '3.0',
            'Accept': 'application/json',
            'Accept-Charset': 'UTF-8',
            'x-ms-version': '2.15',
            'Host': self.host,
            'Authorization': '{} {}'.format(
                self.credentials.token['token_type'],
                self.credentials.token['access_token']
            )
        }

    def set_metadata(self, metadata_name, value):
        setattr(self, metadata_name, value)

    def generate_url(self, expires_in, *args, **kwargs):
        mime_type = mimetypes.guess_type(self.client_video_id)[0]
        self.create_asset_file(self.asset['Id'], self.client_video_id, mime_type)
        access_policy = self.create_access_policy(
            u'AccessPolicy_{}'.format(self.client_video_id.split('.')[0]),
            permissions=AccessPolicyPermissions.WRITE
        )
        self.create_locator(
            access_policy['Id'],
            self.asset['Id'],
            locator_type=LocatorTypes.SAS
        )

        blob_service = BlobServiceClient(self.storage_account_name, self.storage_key)
        sas_url = blob_service.generate_url(
            asset_id=self.asset['Id'],
            blob_name=self.client_video_id,
            expires_in=expires_in
        )
        return sas_url

    def create_asset(self, asset_name):
        """
        Create input Asset to be processed later.

        Input Asset Name format: `UPLOADED::<Edx-video-ID>`
        :param asset_name: Edx video ID
        """
        input_asset_prefix = 'UPLOADED'
        url = "{}Assets".format(self.rest_api_endpoint)
        headers = self.get_headers()
        data = {'Name': '{}::{}'.format(input_asset_prefix, asset_name)}
        response = requests.post(url, headers=headers, json=data)
        if response.status_code == 201:
            return response.json()
        else:
            response.raise_for_status()

    def create_asset_file(self, input_asset_id, file_name, mime_type):
        url = "{}Files".format(self.rest_api_endpoint)
        headers = self.get_headers()
        data = {
            "IsEncrypted": "false",
            "IsPrimary": "false",
            "MimeType": mime_type,
            "Name": file_name,
            "ParentAssetId": input_asset_id
        }
        response = requests.post(url, headers=headers, json=data)
        if response.status_code == 201:
            return response.json()
        else:
            response.raise_for_status()

    def create_access_policy(self, policy_name, duration_in_minutes=120, permissions=AccessPolicyPermissions.NONE):
        url = "{}AccessPolicies".format(self.rest_api_endpoint)
        headers = self.get_headers()
        data = {
            "Name": policy_name,
            "DurationInMinutes": duration_in_minutes,
            "Permissions": permissions
        }
        response = requests.post(url, headers=headers, json=data)
        if response.status_code == 201:
            return response.json()
        else:
            response.raise_for_status()

    def create_locator(self, access_policy_id, input_asset_id, locator_type):
        url = "{}Locators".format(self.rest_api_endpoint)
        headers = self.get_headers()
        start_time = (datetime.utcnow() - timedelta(minutes=10)).replace(microsecond=0).isoformat()
        data = {
            "AccessPolicyId": access_policy_id,
            "AssetId": input_asset_id,
            "StartTime": start_time,
            "Type": locator_type
        }
        response = requests.post(url, headers=headers, json=data)
        if response.status_code == 201:
            return response.json()
        else:
            response.raise_for_status()

    def get_input_asset_by_video_id(self, video_id, asset_prefix='UPLOADED'):
        """
        Fetch input Asset by Edx video ID.

        :param video_id: Edx video ID
        """
        url = "{}Assets".format(self.rest_api_endpoint)
        headers = self.get_headers()
        payload = {"$filter": "Name eq '{}::{}'".format(asset_prefix, video_id)}
        response = requests.get(url, params=payload, headers=headers)
        if response.status_code == 200:
            assets = response.json().get('value', [])
            return assets and assets[0]
        else:
            response.raise_for_status()

    def get_asset_content_keys(self, asset_id, content_key_type=None):
        url = "{}Assets('{}')/ContentKeys".format(self.rest_api_endpoint, asset_id)
        headers = self.get_headers()
        payload = {}

        if content_key_type:
            payload = {'$filter': 'ContentKeyType eq {}'.format(content_key_type)}

        response = requests.get(url, params=payload, headers=headers)
        if response.status_code == 200:
            content_keys = response.json().get('value', [])

            if content_key_type:
                return content_keys[0] if content_keys else None

            return content_keys

        else:
            response.raise_for_status()

    def get_asset_locators(self, input_asset_id, locator_type=None):
        url = "{}Assets('{}')/Locators".format(self.rest_api_endpoint, input_asset_id)
        headers = self.get_headers()
        payload = {}

        if locator_type:
            payload = {'$filter': 'Type eq {}'.format(locator_type)}

        response = requests.get(url, params=payload, headers=headers)
        if response.status_code == 200:
            locators = response.json().get('value', [])

            if locator_type:
                return locators[0] if locators else None

            return locators

        else:
            response.raise_for_status()

    def delete_access_policy(self, access_policy_id):
        url = "{}AccessPolicies('{}')".format(self.rest_api_endpoint, access_policy_id)
        headers = self.get_headers()
        requests.delete(url, headers=headers)

    def delete_locator(self, locator_id):
        url = "{}Locators('{}')".format(self.rest_api_endpoint, locator_id)
        headers = self.get_headers()
        requests.delete(url, headers=headers)

    def get_protection_key_id(self, content_key_type):
        url = "{}GetProtectionKeyId".format(self.rest_api_endpoint)
        headers = self.get_headers()
        payload = {'contentKeyType': content_key_type}
        response = requests.get(url, params=payload, headers=headers)
        if response.status_code == 200:
            return response.json().get('value')
        else:
            response.raise_for_status()

    def get_protection_key(self, protection_key_id):
        url = "{}GetProtectionKey".format(self.rest_api_endpoint)
        headers = self.get_headers()
        payload = {"ProtectionKeyId": "'{}'".format(protection_key_id)}
        response = requests.get(url, params=payload, headers=headers)
        if response.status_code == 200:
            return response.json().get('value')
        else:
            response.raise_for_status()

    def create_content_key(self, name, protection_key_id, content_key_type, encrypted_content_key):
        url = "{}ContentKeys".format(self.rest_api_endpoint)
        headers = self.get_headers()
        data = {
            "Name": name,
            "ProtectionKeyId": protection_key_id,
            "ContentKeyType": content_key_type,
            "ProtectionKeyType": 0,  # to indicate that the protection key Id is the X.509 certificate thumbprint
            "EncryptedContentKey": encrypted_content_key
        }
        response = requests.post(url, headers=headers, json=data)
        if response.status_code == 201:
            return response.json()
        else:
            response.raise_for_status()

    def associate_content_key_with_asset(self, asset_id, content_key_id):
        url = "{}Assets('{}')/$links/ContentKeys".format(self.rest_api_endpoint, asset_id)
        headers = self.get_headers()
        data = {
            "uri": "{}ContentKeys('{}')".format(self.rest_api_endpoint, content_key_id)
        }
        response = requests.post(url, headers=headers, json=data)
        if response.status_code == 204:
            return None
        else:
            response.raise_for_status()

    def create_content_key_authorization_policy(self, name):
        url = "{}ContentKeyAuthorizationPolicies".format(self.rest_api_endpoint)
        headers = self.get_headers()
        data = {
            "Name": name
        }
        response = requests.post(url, headers=headers, json=data)
        if response.status_code == 201:
            return response.json()
        else:
            response.raise_for_status()

    def create_content_key_open_authorization_policy_options(self, name, key_delivery_type):
        url = "{}ContentKeyAuthorizationPolicyOptions".format(self.rest_api_endpoint)
        headers = self.get_headers()
        headers.update({
            "DataServiceVersion": "3.0"
        })
        data = {
            "Name": name,
            "KeyDeliveryType": key_delivery_type,
            "KeyDeliveryConfiguration": "",
            "Restrictions": [{
                "Name": "Open Authorization Policy",
                "KeyRestrictionType": KeyRestrictionType.OPEN,
                "Requirements": None
            }]
        }
        response = requests.post(url, headers=headers, json=data)
        if response.status_code == 201:
            return response.json()
        else:
            response.raise_for_status()

    def associate_authorization_policy_with_option(self, authorization_policy_id, authorization_policy_option_id):
        url = "{}ContentKeyAuthorizationPolicies('{}')/$links/Options".format(self.rest_api_endpoint,
                                                                              authorization_policy_id)
        headers = self.get_headers()
        data = {
            "uri": "{}ContentKeyAuthorizationPolicyOptions('{}')".format(self.rest_api_endpoint,
                                                                         authorization_policy_option_id)
        }
        response = requests.post(url, headers=headers, json=data)
        if response.status_code == 204:
            return None
        else:
            response.raise_for_status()

    def update_content_key(self, content_key_id, data):
        url = "{}ContentKeys('{}')".format(self.rest_api_endpoint, content_key_id)
        headers = self.get_headers()
        response = requests.put(url, headers=headers, json=data)
        if response.status_code == 204:
            return None
        else:
            response.raise_for_status()

    def get_key_delivery_url(self, content_key_id, key_delivery_type):
        url = "{}ContentKeys('{}')/GetKeyDeliveryUrl".format(self.rest_api_endpoint, content_key_id)
        headers = self.get_headers()
        headers.update({
            "DataServiceVersion": "3.0"
        })
        data = {"keyDeliveryType": key_delivery_type}
        response = requests.post(url, headers=headers, json=data)
        if response.status_code == 200:
            return response.json().get('value')
        else:
            response.raise_for_status()

    def create_asset_delivery_policy(self, name, asset_delivery_protocol,
                                     asset_delivery_policy_type, asset_delivery_configuration):
        url = "{}AssetDeliveryPolicies".format(self.rest_api_endpoint)
        headers = self.get_headers()
        data = {
            "Name": name,
            "AssetDeliveryProtocol": asset_delivery_protocol,
            "AssetDeliveryPolicyType": asset_delivery_policy_type,
            "AssetDeliveryConfiguration": asset_delivery_configuration
        }
        response = requests.post(url, headers=headers, json=data)
        if response.status_code == 201:
            return response.json()
        else:
            response.raise_for_status()

    def associate_delivery_polic_with_asset(self, asset_id, delivery_policy_id):
        url = "{}Assets('{}')/$links/DeliveryPolicies".format(self.rest_api_endpoint, asset_id)
        headers = self.get_headers()
        data = {
            "uri": "{}AssetDeliveryPolicies('{}')".format(self.rest_api_endpoint, delivery_policy_id)
        }
        response = requests.post(url, headers=headers, json=data)
        if response.status_code == 204:
            return None
        else:
            response.raise_for_status()

    def get_asset_delivery_policies(self, asset_id):
        url = "{}Assets('{}')/DeliveryPolicies".format(self.rest_api_endpoint, asset_id)
        headers = self.get_headers()
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            return response.json().get('value', [])
        else:
            response.raise_for_status()

    def delete_delivery_policy_link_from_asset(self, asset_id, delivery_policy_id):
        url = "{}Assets('{}')/$links/DeliveryPolicies('{}')".format(self.rest_api_endpoint,
                                                                    asset_id,
                                                                    delivery_policy_id)
        headers = self.get_headers()
        requests.delete(url, headers=headers)

    def delete_delivery_policy(self, delivery_policy_id):
        url = "{}DeliveryPolicies('{}')".format(self.rest_api_endpoint, delivery_policy_id)
        headers = self.get_headers()
        requests.delete(url, headers=headers)

    def get_media_processor(self, name='Media Encoder Standard'):
        url = "{}MediaProcessors()".format(self.rest_api_endpoint)
        headers = self.get_headers()
        payload = {"$filter": "Name eq '{}'".format(name)}
        response = requests.get(url, params=payload, headers=headers)
        if response.status_code == 200:
            try:
                media_processor = response.json().get('value', [])[0]
            except IndexError:
                http_error_msg = '%s Response: %s for url: %s' % (response.status_code, response.json(), response.url)
                raise requests.HTTPError(http_error_msg)
            return media_processor
        else:
            response.raise_for_status()

    def create_job(self, input_asset_id, video_id, media_processor_id=None):
        """
        Create encode Job on Azure Media Service for input Asset video.

        Output Asset Name format: `ENCODED::<Edx-video-ID>`
        :param input_asset_id:  AzureMS Asset ID which contains encode target video.
        :param video_id: Edx video ID
        :param media_processor_id: ID of encode processor (defaults to Standard
        ref: https://docs.microsoft.com/en-us/azure/media-services/media-services-encode-asset
        """
        output_asset_prefix = 'ENCODED'
        if media_processor_id is None:
            media_processor_props = self.get_media_processor()
            media_processor_id = media_processor_props[u'Id']

        input_asset_url = "{}Assets('{}')".format(self.rest_api_endpoint, input_asset_id)
        output_asset_name = '{}::{}'.format(output_asset_prefix, video_id)

        url = "{}Jobs".format(self.rest_api_endpoint)
        headers = self.get_headers()
        headers.update({
            "Accept": "application/json;odata=verbose"
        })
        job_config_data = {
            "Name": "AssetEncodeJob:{}".format(input_asset_id),
            "InputMediaAssets": [
                {
                    "__metadata": {
                        "uri": input_asset_url
                    }
                }
            ],
            "Tasks": [
                {
                    "Configuration": "Content Adaptive Multiple Bitrate MP4",  # streaming and downloading
                    "MediaProcessorId": media_processor_id,
                    "TaskBody":
                        "<?xml version=\"1.0\" encoding=\"utf-8\"?><taskBody><inputAsset>JobInputAsset(0)"
                        "</inputAsset><outputAsset assetName=\"{}\">JobOutputAsset(0)</outputAsset></taskBody>"
                        .format(output_asset_name)
                }
            ]
        }

        response = requests.post(url, headers=headers, json=job_config_data)
        if response.status_code == 201:
            return response.json()
        else:
            response.raise_for_status()

    def get_job(self, job_id):
        url = "{}Jobs('{}')".format(self.rest_api_endpoint, job_id)
        headers = self.get_headers()
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            job = response.json()
            return job
        else:
            response.raise_for_status()

    def get_output_media_asset(self, job_id):
        url = "{}Jobs('{}')/OutputMediaAssets".format(self.rest_api_endpoint, job_id)
        headers = self.get_headers()
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            asset = response.json().get('value', [])[0]
            return asset
        else:
            response.raise_for_status()

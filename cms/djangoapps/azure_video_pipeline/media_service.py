# -*- coding: utf-8 -*-
from datetime import datetime, timedelta
import logging
import mimetypes
import re

from django.core.exceptions import MultipleObjectsReturned, ObjectDoesNotExist
from msrestazure.azure_active_directory import ServicePrincipalCredentials
import requests
from requests import HTTPError

from .blobs_service import BlobServiceClient


LOGGER = logging.getLogger(__name__)


class LocatorTypes(object):
    SAS = 1
    OnDemandOrigin = 2


class AccessPolicyPermissions(object):
    NONE = 0
    READ = 1
    WRITE = 2
    DELETE = 3


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

    def upload_video_transcript(self, edx_video_id, transcript_file):
        file_name = transcript_file.name
        asset = self.get_input_asset_by_video_id(edx_video_id, asset_prefix='ENCODED')

        if not asset:
            raise ObjectDoesNotExist(
                'Target Video to which you are trying to attach transcripts is no longer available on Azure'
                ' or is corrupted in some way.'
            )

        mime_type = mimetypes.guess_type(file_name)[0]

        try:
            asset_file = self.create_asset_file(asset['Id'], file_name, mime_type)
        except HTTPError:
            raise MultipleObjectsReturned(
                'This may be happening because of file name conflict. Try to change the file name and upload again.'
            )

        access_policy = self.create_access_policy(
            u'AccessPolicy_{}'.format(file_name.split('.')[0]),
            duration_in_minutes=30,
            permissions=AccessPolicyPermissions.WRITE
        )
        locator = self.create_locator(
            access_policy['Id'],
            asset['Id'],
            locator_type=LocatorTypes.SAS
        )
        blob_service_client = BlobServiceClient(self.storage_account_name, self.storage_key)
        blob_service_client.blob_service.put_block_blob_from_file(
            'asset-{}'.format(asset['Id'].split(':')[-1]),
            file_name,
            transcript_file.file
        )

        self.delete_locator(locator['Id'])
        self.delete_access_policy(access_policy['Id'])
        self.update_asset_file(asset_file['Id'], file_data={
            "size": transcript_file._size,
            "ctype": transcript_file.content_type
        })

    def get_locators_list(self, locator_type=LocatorTypes.OnDemandOrigin):
        url = '{}Locators'.format(self.rest_api_endpoint)
        headers = self.get_headers()
        payload = {'$filter': 'Type eq {}'.format(locator_type)}
        response = requests.get(url, params=payload, headers=headers)
        if response.status_code == 200:
            locators = response.json().get('value', [])
            return locators
        else:
            response.raise_for_status()

    def get_asset_locator(self, input_asset_id, locator_type):
        url = "{}Assets('{}')/Locators".format(self.rest_api_endpoint, input_asset_id)
        headers = self.get_headers()
        payload = {'$filter': 'Type eq {}'.format(locator_type)}
        response = requests.get(url, params=payload, headers=headers)
        if response.status_code == 200:
            locators = response.json().get('value', [])
            return locators[0] if locators else None
        else:
            response.raise_for_status()

    def get_asset_files(self, input_asset_id):
        url = "{}Assets('{}')/Files".format(self.rest_api_endpoint, input_asset_id)
        headers = self.get_headers()
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            files = response.json().get('value', [])
            return files
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

    def update_asset_file(self, file_id, file_data):
        """
        Update AssetFile with special MERGE request to set proper file size.

        :param file_id: Azure AssetFile identifier
        :param file_data: (dict) file info to be updated
        """
        url = "{}Files('{}')".format(self.rest_api_endpoint, file_id)
        headers = self.get_headers()
        json_data = {
            "ContentFileSize": "{size}".format(**file_data),
            "MimeType": "{ctype}".format(**file_data)
        }
        response = requests.request('MERGE', url, headers=headers, json=json_data)
        if not response.status_code == 204:
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

    def delete_access_policy(self, access_policy_id):
        url = "{}AccessPolicies('{}')".format(self.rest_api_endpoint, access_policy_id)
        headers = self.get_headers()
        requests.delete(url, headers=headers)

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

    def delete_locator(self, locator_id):
        url = "{}Locators('{}')".format(self.rest_api_endpoint, locator_id)
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
                raise HTTPError(http_error_msg)
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

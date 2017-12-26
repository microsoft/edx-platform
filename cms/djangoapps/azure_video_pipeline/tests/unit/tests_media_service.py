import unittest

from azure_video_pipeline.media_service import AccessPolicyPermissions, LocatorTypes, MediaServiceClient
from freezegun import freeze_time
import mock
from requests import HTTPError


class MediaServiceClientTests(unittest.TestCase):

    @mock.patch('azure_video_pipeline.media_service.ServicePrincipalCredentials')
    def make_one(self, service_principal_credentials):
        azure_config = {
            'client_id': 'client_id',
            'secret': 'client_secret',
            'tenant': 'tenant',
            'rest_api_endpoint': 'https://rest_api_endpoint/api/',
            'storage_account_name': 'storage_account_name',
            'storage_key': 'storage_key'
        }
        media_services = MediaServiceClient(azure_config)
        media_services.credentials = mock.Mock(token={'token_type': 'token_type', 'access_token': 'access_token'})
        return media_services

    @mock.patch('azure_video_pipeline.media_service.MediaServiceClient.get_headers',
                return_value={})
    @mock.patch('azure_video_pipeline.media_service.requests.get',
                return_value=mock.Mock(status_code=400, raise_for_status=mock.Mock(side_effect=HTTPError)))
    @mock.patch('azure_video_pipeline.media_service.requests.post',
                return_value=mock.Mock(status_code=400, raise_for_status=mock.Mock(side_effect=HTTPError)))
    def raise_for_status(self, requests_post, requests_get, headers, func, func_args=None):
        media_services = self.make_one()
        with self.assertRaises(HTTPError):
            if func_args:
                getattr(media_services, func)(*func_args)
            else:
                getattr(media_services, func)()

    def test_get_headers(self):
        media_services = self.make_one()
        headers = media_services.get_headers()
        expected_headers = {
            'Content-Type': 'application/json',
            'DataServiceVersion': '1.0',
            'MaxDataServiceVersion': '3.0',
            'Accept': 'application/json',
            'Accept-Charset': 'UTF-8',
            'x-ms-version': '2.15',
            'Host': 'rest_api_endpoint',
            'Authorization': 'token_type access_token'
        }
        self.assertEqual(headers, expected_headers)

    def test_set_metadata(self):
        media_services = self.make_one()
        media_services.set_metadata('value_name', 'value')
        self.assertEqual(media_services.value_name, 'value')

    @mock.patch('azure_video_pipeline.media_service.MediaServiceClient.create_asset_file',
                return_value={})
    @mock.patch('azure_video_pipeline.media_service.MediaServiceClient.create_access_policy',
                return_value={'Id': 'access_policy_id'})
    @mock.patch('azure_video_pipeline.media_service.MediaServiceClient.create_locator',
                return_value={})
    @mock.patch('azure_video_pipeline.media_service.BlobServiceClient',
                return_value=mock.Mock(generate_url=mock.Mock(
                    return_value='sas_url')))
    def test_generate_url(self, blob_service_client, create_locator, create_access_policy, create_asset_file):
        media_services = self.make_one()
        media_services.client_video_id = 'file_name.mp4'
        media_services.asset = {
            'Id': 'asset_id'
        }
        sas_url = media_services.generate_url(expires_in=123456789)

        create_asset_file.assert_called_once_with(
            'asset_id', 'file_name.mp4', 'video/mp4'
        )
        create_access_policy.assert_called_once_with(
            u'AccessPolicy_file_name',
            permissions=AccessPolicyPermissions.WRITE
        )
        create_locator.assert_called_once_with(
            'access_policy_id',
            'asset_id',
            locator_type=LocatorTypes.SAS
        )
        blob_service_client.assert_called_once_with(
            'storage_account_name',
            'storage_key'
        )
        blob_service_client().generate_url.assert_called_once_with(
            asset_id='asset_id',
            blob_name='file_name.mp4',
            expires_in=123456789
        )
        self.assertEqual(sas_url, 'sas_url')

    @mock.patch('azure_video_pipeline.media_service.MediaServiceClient.get_headers',
                return_value={})
    @mock.patch('azure_video_pipeline.media_service.requests.get',
                return_value=mock.Mock(status_code=200,
                                       json=mock.Mock(return_value={'value': ['locator1', 'locator2']})))
    def test_get_locators_list(self, requests_get, headers):
        media_services = self.make_one()
        locators = media_services.get_locators_list(LocatorTypes.OnDemandOrigin)
        requests_get.assert_called_once_with(
            'https://rest_api_endpoint/api/Locators',
            headers={},
            params={'$filter': 'Type eq {}'.format(LocatorTypes.OnDemandOrigin)}
        )
        self.assertEqual(locators, ['locator1', 'locator2'])

    def test_raise_for_status_get_list_locators(self):
        self.raise_for_status(func='get_locators_list')

    @mock.patch('azure_video_pipeline.media_service.MediaServiceClient.get_headers',
                return_value={})
    @mock.patch('azure_video_pipeline.media_service.requests.get',
                return_value=mock.Mock(status_code=200,
                                       json=mock.Mock(return_value={'value': ['locator']})))
    def test_get_asset_locator(self, requests_get, headers):
        media_services = self.make_one()
        asset_id = 'asset_id'
        locator = media_services.get_asset_locator(asset_id, LocatorTypes.SAS)
        requests_get.assert_called_once_with(
            "https://rest_api_endpoint/api/Assets('{}')/Locators".format(asset_id),
            headers={},
            params = {'$filter': 'Type eq {}'.format(LocatorTypes.SAS)}
        )
        self.assertEqual(locator, 'locator')

    def test_raise_for_status_get_asset_locator(self):
        self.raise_for_status(func='get_asset_locator', func_args=['asset_id', '1'])

    @mock.patch('azure_video_pipeline.media_service.MediaServiceClient.get_headers',
                return_value={})
    @mock.patch('azure_video_pipeline.media_service.requests.get',
                return_value=mock.Mock(status_code=200,
                                       json=mock.Mock(return_value={'value': ['file1', 'file2']})))
    def test_get_asset_files(self, requests_get, headers):
        media_services = self.make_one()
        asset_id = 'asset_id'
        files = media_services.get_asset_files(asset_id)
        requests_get.assert_called_once_with(
            "https://rest_api_endpoint/api/Assets('{}')/Files".format(asset_id),
            headers={}
        )
        self.assertEqual(files, ['file1', 'file2'])

    def test_raise_for_status_get_asset_files(self):
        self.raise_for_status(func='get_asset_files', func_args=['asset_id'])

    @mock.patch('azure_video_pipeline.media_service.MediaServiceClient.get_headers',
                return_value={})
    @mock.patch('azure_video_pipeline.media_service.requests.post',
                return_value=mock.Mock(status_code=201,
                                       json=mock.Mock(return_value={'asset_id': 'asset_id',
                                                                    'asset_name': 'asset_name'})))
    def test_create_asset(self, requests_post, headers):
        media_services = self.make_one()
        asset_name = 'asset_name'
        asset = media_services.create_asset(asset_name)
        requests_post.assert_called_once_with(
            "https://rest_api_endpoint/api/Assets",
            headers={},
            json={'Name': 'UPLOADED::asset_name'}
        )
        self.assertEqual(asset, {'asset_id': 'asset_id', 'asset_name': 'asset_name'})

    def test_raise_for_status_create_assets(self):
        self.raise_for_status(func='create_asset', func_args=['asset_name'])

    @mock.patch('azure_video_pipeline.media_service.MediaServiceClient.get_headers',
                return_value={})
    @mock.patch('azure_video_pipeline.media_service.requests.post',
                return_value=mock.Mock(status_code=201,
                                       json=mock.Mock(return_value={'file_id': 'file_id',
                                                                    'file_name': 'file_name'})))
    def test_create_asset_file(self, requests_post, headers):
        media_services = self.make_one()
        asset_id = 'asset_id'
        file_name = 'file_name'
        mime_type = 'mime_type'
        asset = media_services.create_asset_file(asset_id, file_name, mime_type)
        expected_data = {
            "IsEncrypted": "false",
            "IsPrimary": "false",
            "MimeType": mime_type,
            "Name": file_name,
            "ParentAssetId": asset_id
        }
        requests_post.assert_called_once_with(
            "https://rest_api_endpoint/api/Files",
            headers={},
            json=expected_data
        )
        self.assertEqual(asset, {'file_id': 'file_id', 'file_name': 'file_name'})

    def test_raise_for_status_create_asset_file(self):
        self.raise_for_status(func='create_asset_file', func_args=['asset_id', 'file_name', 'mime_type'])

    @mock.patch('azure_video_pipeline.media_service.MediaServiceClient.get_headers',
                return_value={})
    @mock.patch('azure_video_pipeline.media_service.requests.post',
                return_value=mock.Mock(status_code=201,
                                       json=mock.Mock(return_value={'policy_id': 'policy_id',
                                                                    'policy_name': 'policy_name'})))
    def test_create_access_policy(self, requests_post, headers):
        media_services = self.make_one()
        policy_name = 'policy_name'
        asset = media_services.create_access_policy(policy_name)
        expected_data = {
            "Name": policy_name,
            "DurationInMinutes": 120,
            "Permissions": AccessPolicyPermissions.NONE
        }
        requests_post.assert_called_once_with(
            "https://rest_api_endpoint/api/AccessPolicies",
            headers={},
            json=expected_data
        )
        self.assertEqual(asset, {'policy_id': 'policy_id', 'policy_name': 'policy_name'})

    def test_raise_for_status_create_access_policy(self):
        self.raise_for_status(func='create_access_policy', func_args=['policy_name'])

    @mock.patch('azure_video_pipeline.media_service.MediaServiceClient.get_headers',
                return_value={})
    @mock.patch('azure_video_pipeline.media_service.requests.post',
                return_value=mock.Mock(status_code=201,
                                       json=mock.Mock(return_value={'locator_id': 'locator_id',
                                                                    'locator_name': 'locator_name'})))
    @freeze_time("2017-11-01")
    def test_create_locator(self, requests_post, headers):
        media_services = self.make_one()
        access_policy_id = 'access_policy_id'
        asset_id = 'asset_id'
        locator_type = 'locator_type'
        asset = media_services.create_locator(access_policy_id, asset_id, locator_type)
        expected_data = {
            "AccessPolicyId": access_policy_id,
            "AssetId": asset_id,
            "StartTime": '2017-10-31T23:50:00',
            "Type": locator_type
        }
        requests_post.assert_called_once_with(
            "https://rest_api_endpoint/api/Locators",
            headers={},
            json=expected_data
        )
        self.assertEqual(asset, {'locator_id': 'locator_id', 'locator_name': 'locator_name'})

    def test_raise_for_status_create_locator(self):
        self.raise_for_status(func='create_locator', func_args=['access_policy_id', 'asset_id', 'locator_type'])

    @mock.patch('azure_video_pipeline.media_service.MediaServiceClient.get_headers', return_value={})
    @mock.patch('azure_video_pipeline.media_service.requests.get', return_value=mock.Mock(
        status_code=200, json=mock.Mock(return_value={'value': [{'id', 'asset_id'}]})
    ))
    def test_get_input_asset_by_video_id(self, requests_get_mock, _get_headers_mock):
        # arrange
        media_services = self.make_one()
        video_id = 'test:video:id'
        # act
        asset = media_services.get_input_asset_by_video_id(video_id)
        # assert
        requests_get_mock.assert_called_once_with(
            "https://rest_api_endpoint/api/Assets",
            headers={},
            params = {'$filter': "Name eq 'UPLOADED::{}'".format(video_id)}
        )
        self.assertEqual(asset, {'id', 'asset_id'})

import unittest

from azure_video_pipeline.media_service import (
    AccessPolicyPermissions,
    LocatorTypes,
    MediaServiceClient,
    KeyRestrictionType
)
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
                                       json=mock.Mock(return_value={'value': ['locator']})))
    def test_get_asset_locators(self, requests_get, headers):
        media_services = self.make_one()
        asset_id = 'asset_id'
        locator = media_services.get_asset_locators(asset_id, LocatorTypes.SAS)
        requests_get.assert_called_once_with(
            "https://rest_api_endpoint/api/Assets('{}')/Locators".format(asset_id),
            headers={},
            params={'$filter': 'Type eq {}'.format(LocatorTypes.SAS)}
        )
        self.assertEqual(locator, 'locator')

    def test_raise_for_status_get_asset_locators(self):
        self.raise_for_status(func='get_asset_locators', func_args=['asset_id', '1'])

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
            params={'$filter': "Name eq 'UPLOADED::{}'".format(video_id)}
        )
        self.assertEqual(asset, {'id', 'asset_id'})

    @mock.patch('azure_video_pipeline.media_service.MediaServiceClient.get_headers', return_value={})
    @mock.patch('azure_video_pipeline.media_service.requests.get', return_value=mock.Mock(
        status_code=200, json=mock.Mock(return_value={'value': 'protection_key_id'})
    ))
    def test_get_protection_key_id(self, requests_get_mock, _get_headers_mock):
        # arrange
        media_services = self.make_one()
        content_key_type = 'content_key_type'
        # act
        protection_key_id = media_services.get_protection_key_id(content_key_type)
        # assert
        requests_get_mock.assert_called_once_with(
            "https://rest_api_endpoint/api/GetProtectionKeyId",
            headers={},
            params={'contentKeyType': content_key_type}
        )
        self.assertEqual(protection_key_id, 'protection_key_id')

    @mock.patch('azure_video_pipeline.media_service.MediaServiceClient.get_headers', return_value={})
    @mock.patch('azure_video_pipeline.media_service.requests.get', return_value=mock.Mock(
        status_code=200, json=mock.Mock(return_value={'value': 'protection_key'})
    ))
    def test_get_protection_key(self, requests_get_mock, _get_headers_mock):
        # arrange
        media_services = self.make_one()
        protection_key_id = 'protection_key_id'
        # act
        protection_key = media_services.get_protection_key(protection_key_id)
        # assert
        requests_get_mock.assert_called_once_with(
            "https://rest_api_endpoint/api/GetProtectionKey",
            headers={},
            params={"ProtectionKeyId": "'{}'".format(protection_key_id)}
        )
        self.assertEqual(protection_key, 'protection_key')

    @mock.patch('azure_video_pipeline.media_service.MediaServiceClient.get_headers', return_value={})
    @mock.patch('azure_video_pipeline.media_service.requests.post', return_value=mock.Mock(
        status_code=201, json=mock.Mock(return_value={'Id': 'content_key_id'})
    ))
    def test_create_content_key(self, requests_post_mock, _get_headers_mock):
        # arrange
        media_services = self.make_one()
        name = 'name content_key'
        protection_key_id = 'protection_key_id'
        content_key_type = 'content_key_type'
        encrypted_content_key = 'encrypted_content_key'
        # act
        content_key = media_services.create_content_key(name, protection_key_id,
                                                        content_key_type, encrypted_content_key)
        # assert
        requests_post_mock.assert_called_once_with(
            "https://rest_api_endpoint/api/ContentKeys",
            headers={},
            json={
                "Name": name,
                "ProtectionKeyId": protection_key_id,
                "ContentKeyType": content_key_type,
                "ProtectionKeyType": 0,
                "EncryptedContentKey": encrypted_content_key
            }
        )
        self.assertEqual(content_key, {'Id': 'content_key_id'})

    @mock.patch('azure_video_pipeline.media_service.MediaServiceClient.get_headers', return_value={})
    @mock.patch('azure_video_pipeline.media_service.requests.put', return_value=mock.Mock(
        status_code=204, json=mock.Mock()
    ))
    def test_update_content_key(self, requests_put_mock, _get_headers_mock):
        # arrange
        media_services = self.make_one()
        content_key_id = 'content_key_id'
        data = {'key': 'value'}
        # act
        content_key = media_services.update_content_key(content_key_id, data)
        # assert
        requests_put_mock.assert_called_once_with(
            "https://rest_api_endpoint/api/ContentKeys('{}')".format(content_key_id),
            headers={},
            json=data
        )
        self.assertIsNone(content_key)

    @mock.patch('azure_video_pipeline.media_service.MediaServiceClient.get_headers', return_value={})
    @mock.patch('azure_video_pipeline.media_service.requests.post', return_value=mock.Mock(
        status_code=204, json=mock.Mock()
    ))
    def test_associate_content_key_with_asset(self, requests_post_mock, _get_headers_mock):
        # arrange
        media_services = self.make_one()
        asset_id = 'asset_id'
        content_key_id = 'content_key_id'
        data = {
            "uri": "https://rest_api_endpoint/api/ContentKeys('{}')".format(content_key_id)
        }
        # act
        response = media_services.associate_content_key_with_asset(asset_id, content_key_id)
        # assert
        requests_post_mock.assert_called_once_with(
            "https://rest_api_endpoint/api/Assets('{}')/$links/ContentKeys".format(asset_id),
            headers={},
            json=data
        )
        self.assertIsNone(response)

    @mock.patch('azure_video_pipeline.media_service.MediaServiceClient.get_headers', return_value={})
    @mock.patch('azure_video_pipeline.media_service.requests.post', return_value=mock.Mock(
        status_code=201, json=mock.Mock(return_value={'Id': 'content_key_authorization_policy_id'})
    ))
    def test_create_content_key_authorization_policy(self, requests_post_mock, _get_headers_mock):
        # arrange
        media_services = self.make_one()
        name = 'content_key_authorization_policy name '
        # act
        response = media_services.create_content_key_authorization_policy(name)
        # assert
        requests_post_mock.assert_called_once_with(
            "https://rest_api_endpoint/api/ContentKeyAuthorizationPolicies",
            headers={},
            json={"Name": name}
        )
        self.assertEqual(response, {'Id': 'content_key_authorization_policy_id'})

    @mock.patch('azure_video_pipeline.media_service.MediaServiceClient.get_headers', return_value={})
    @mock.patch('azure_video_pipeline.media_service.requests.post', return_value=mock.Mock(
        status_code=201, json=mock.Mock(return_value={'Id': 'create_content_key_open_authorization_policy_options'})
    ))
    def test_create_content_key_open_authorization_policy_options(self, requests_post_mock, _get_headers_mock):
        # arrange
        media_services = self.make_one()
        name = 'name'
        key_delivery_type = 'key_delivery_type'
        # act
        response = media_services.create_content_key_open_authorization_policy_options(name, key_delivery_type)
        # assert
        requests_post_mock.assert_called_once_with(
            "https://rest_api_endpoint/api/ContentKeyAuthorizationPolicyOptions",
            headers={"DataServiceVersion": "3.0"},
            json={
                "Name": name,
                "KeyDeliveryType": key_delivery_type,
                "KeyDeliveryConfiguration": "",
                "Restrictions": [{
                    "Name": "Open Authorization Policy",
                    "KeyRestrictionType": KeyRestrictionType.OPEN,
                    "Requirements": None
                }]
            }
        )
        self.assertEqual(response, {'Id': 'create_content_key_open_authorization_policy_options'})

    @mock.patch('azure_video_pipeline.media_service.MediaServiceClient.get_headers', return_value={})
    @mock.patch('azure_video_pipeline.media_service.requests.post', return_value=mock.Mock(
        status_code=204, json=mock.Mock()
    ))
    def test_associate_authorization_policy_with_option(self, requests_post_mock, _get_headers_mock):
        # arrange
        media_services = self.make_one()
        authorization_policy_id = 'authorization_policy_id'
        authorization_policy_option_id = 'authorization_policy_option_id'
        data = {
            "uri": "https://rest_api_endpoint/api/ContentKeyAuthorizationPolicyOptions('{}')".format(
                authorization_policy_option_id
            )
        }
        # act
        response = media_services.associate_authorization_policy_with_option(
            authorization_policy_id,
            authorization_policy_option_id
        )
        # assert
        requests_post_mock.assert_called_once_with(
            "https://rest_api_endpoint/api/ContentKeyAuthorizationPolicies('{}')/$links/Options".format(
                authorization_policy_id
            ),
            headers={},
            json=data
        )
        self.assertIsNone(response)

    @mock.patch('azure_video_pipeline.media_service.MediaServiceClient.get_headers', return_value={})
    @mock.patch('azure_video_pipeline.media_service.requests.post', return_value=mock.Mock(
        status_code=200, json=mock.Mock(return_value={'value': 'key_delivery_url'})
    ))
    def test_get_key_delivery_url(self, requests_post_mock, _get_headers_mock):
        # arrange
        media_services = self.make_one()
        content_key_id = 'content_key_id'
        key_delivery_type = 'key_delivery_type'
        # act
        response = media_services.get_key_delivery_url(content_key_id, key_delivery_type)
        # assert
        requests_post_mock.assert_called_once_with(
            "https://rest_api_endpoint/api/ContentKeys('{}')/GetKeyDeliveryUrl".format(content_key_id),
            headers={"DataServiceVersion": "3.0"},
            json={"keyDeliveryType": key_delivery_type}
        )
        self.assertEqual(response, 'key_delivery_url')

    @mock.patch('azure_video_pipeline.media_service.MediaServiceClient.get_headers', return_value={})
    @mock.patch('azure_video_pipeline.media_service.requests.post', return_value=mock.Mock(
        status_code=201, json=mock.Mock(return_value={'Id': 'asset_delivery_policy'})
    ))
    def test_create_asset_delivery_policy(self, requests_post_mock, _get_headers_mock):
        # arrange
        media_services = self.make_one()
        name = 'name'
        asset_delivery_protocol = 'asset_delivery_protocol'
        asset_delivery_policy_type = 'asset_delivery_policy_type'
        asset_delivery_configuration = 'asset_delivery_configuration'
        # act
        response = media_services.create_asset_delivery_policy(name,
                                                               asset_delivery_protocol,
                                                               asset_delivery_policy_type,
                                                               asset_delivery_configuration)
        # assert
        requests_post_mock.assert_called_once_with(
            "https://rest_api_endpoint/api/AssetDeliveryPolicies",
            headers={},
            json={
                "Name": name,
                "AssetDeliveryProtocol": asset_delivery_protocol,
                "AssetDeliveryPolicyType": asset_delivery_policy_type,
                "AssetDeliveryConfiguration": asset_delivery_configuration
            }
        )
        self.assertEqual(response, {'Id': 'asset_delivery_policy'})

    @mock.patch('azure_video_pipeline.media_service.MediaServiceClient.get_headers', return_value={})
    @mock.patch('azure_video_pipeline.media_service.requests.post', return_value=mock.Mock(
        status_code=204, json=mock.Mock()
    ))
    def test_associate_delivery_polic_with_asset(self, requests_post_mock, _get_headers_mock):
        # arrange
        media_services = self.make_one()
        asset_id = 'asset_id'
        delivery_policy_id = 'delivery_policy_id'
        data = {
            "uri": "https://rest_api_endpoint/api/AssetDeliveryPolicies('{}')".format(
                delivery_policy_id
            )
        }
        # act
        response = media_services.associate_delivery_polic_with_asset(
            asset_id,
            delivery_policy_id
        )
        # assert
        requests_post_mock.assert_called_once_with(
            "https://rest_api_endpoint/api/Assets('{}')/$links/DeliveryPolicies".format(
                asset_id
            ),
            headers={},
            json=data
        )
        self.assertIsNone(response)

    @mock.patch('azure_video_pipeline.media_service.MediaServiceClient.get_headers', return_value={})
    @mock.patch('azure_video_pipeline.media_service.requests.get', return_value=mock.Mock(
        status_code=200, json=mock.Mock(return_value={'value': 'asset_delivery_policies'})
    ))
    def test_get_asset_delivery_policies(self, requests_get_mock, _get_headers_mock):
        # arrange
        media_services = self.make_one()
        asset_id = 'asset_id'
        # act
        response = media_services.get_asset_delivery_policies(asset_id)
        # assert
        requests_get_mock.assert_called_once_with(
            "https://rest_api_endpoint/api/Assets('{}')/DeliveryPolicies".format(asset_id),
            headers={}
        )
        self.assertEqual(response, 'asset_delivery_policies')

    @mock.patch('azure_video_pipeline.media_service.MediaServiceClient.get_headers', return_value={})
    @mock.patch('azure_video_pipeline.media_service.requests.delete')
    def test_delete_delivery_policy_link_from_asset(self, requests_delete_mock, _get_headers_mock):
        # arrange
        media_services = self.make_one()
        asset_id = 'asset_id'
        delivery_policy_id = 'delivery_policy_id'
        # act
        media_services.delete_delivery_policy_link_from_asset(asset_id, delivery_policy_id)
        # assert
        requests_delete_mock.assert_called_once_with(
            "https://rest_api_endpoint/api/Assets('{}')/$links/DeliveryPolicies('{}')".format(
                asset_id,
                delivery_policy_id
            ),
            headers={}
        )

    @mock.patch('azure_video_pipeline.media_service.MediaServiceClient.get_headers', return_value={})
    @mock.patch('azure_video_pipeline.media_service.requests.delete')
    def test_delete_delivery_policy(self, requests_delete_mock, _get_headers_mock):
        # arrange
        media_services = self.make_one()
        delivery_policy_id = 'delivery_policy_id'
        # act
        media_services.delete_delivery_policy(delivery_policy_id)
        # assert
        requests_delete_mock.assert_called_once_with(
            "https://rest_api_endpoint/api/DeliveryPolicies('{}')".format(delivery_policy_id),
            headers={}
        )

    @mock.patch('azure_video_pipeline.media_service.MediaServiceClient.get_headers', return_value={})
    @mock.patch('azure_video_pipeline.media_service.requests.get', return_value=mock.Mock(
        status_code=200, json=mock.Mock(return_value={'value': ['content_key']})
    ))
    def test_get_asset_delivery_policies(self, requests_get_mock, _get_headers_mock):
        # arrange
        media_services = self.make_one()
        asset_id = 'asset_id'
        content_key_type = 'content_key_type'
        # act
        response = media_services.get_asset_content_keys(asset_id, content_key_type)
        # assert
        requests_get_mock.assert_called_once_with(
            "https://rest_api_endpoint/api/Assets('{}')/ContentKeys".format(asset_id),
            headers={},
            params={'$filter': 'ContentKeyType eq {}'.format(content_key_type)}
        )
        self.assertEqual(response, 'content_key')

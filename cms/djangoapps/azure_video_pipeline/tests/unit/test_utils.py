import json
from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase
from django.test.utils import override_settings
from requests import HTTPError
from edxval.models import Video

from azure_video_pipeline.media_service import (
    ContentKeyType, KeyDeliveryType, AssetDeliveryProtocol, AssetDeliveryPolicyType,
    AssetDeliveryPolicyConfigurationKey, AccessPolicyPermissions, LocatorTypes
)
from azure_video_pipeline.utils import (
    get_azure_config, get_media_service_client,
    remove_encryption, encrypt_file, remove_access_policies_and_locators,
    create_content_key_and_associate_with_encoded_asset, create_authorization_policy_and_associate_with_content_key,
    create_delivery_policy_and_associate_with_encoded_asset, create_access_policies_and_locators,
    remove_delivery_policy_link_from_asset_and_delivery_policy,
    get_video_info, get_captions_info, _drop_http_or_https, get_captions_and_video_info)
import mock


@override_settings(AZURE_CLIENT_ID='test_client_id',
                   AZURE_CLIENT_SECRET='test_client_secret',
                   AZURE_TENANT='test_tenant',
                   AZURE_REST_API_ENDPOINT='test_rest_api_endpoint',
                   AZURE_STORAGE_ACCOUNT_NAME='test_storage_account_name',
                   AZURE_STORAGE_KEY='test_storage_key')
class UtilsTests(SimpleTestCase):

    @mock.patch('azure_video_pipeline.utils.MediaServiceClient')
    @mock.patch('azure_video_pipeline.utils.get_azure_config', return_value={})
    def test_get_media_services(self, get_azure_config, media_services_client):
        media_services = get_media_service_client('org')
        get_azure_config.assert_called_once_with('org')
        media_services_client.assert_called_once_with({})
        self.assertEqual(media_services, media_services_client())

    def test_get_azure_config_for_organization(self):
        with mock.patch('azure_video_pipeline.models.AzureOrgProfile.objects.filter',
                        return_value=mock.Mock(first=mock.Mock(
                            return_value=mock.Mock(to_dict=mock.Mock(
                                return_value={'client_id': 'client_id',
                                              'secret': 'client_secret',
                                              'tenant': 'tenant',
                                              'rest_api_endpoint': 'rest_api_endpoint',
                                              'storage_account_name': 'storage_account_name',
                                              'storage_key': 'storage_key'}))))):
            azure_config = get_azure_config('name_org')

            expected_azure_config = {
                'client_id': 'client_id',
                'secret': 'client_secret',
                'tenant': 'tenant',
                'rest_api_endpoint': 'rest_api_endpoint',
                'storage_account_name': 'storage_account_name',
                'storage_key': 'storage_key'
            }
            self.assertEqual(azure_config, expected_azure_config)

    def test_get_azure_config_for_platform(self):
        with mock.patch('azure_video_pipeline.models.AzureOrgProfile.objects.filter',
                        return_value=mock.Mock(first=mock.Mock(return_value=None))):
            # arrange:
            expected_azure_config = {
                'client_id': 'test_client_id',
                'secret': 'test_client_secret',
                'tenant': 'test_tenant',
                'rest_api_endpoint': 'test_rest_api_endpoint',
                'storage_account_name': 'test_storage_account_name',
                'storage_key': 'test_storage_key'
            }
            # act:
            azure_config = get_azure_config('name_org')
            # assert:
            self.assertEqual(azure_config, expected_azure_config)

    @override_settings(AZURE_CLIENT_ID=None,
                       AZURE_CLIENT_SECRET=None,
                       AZURE_TENANT=None,
                       AZURE_REST_API_ENDPOINT=None,
                       AZURE_STORAGE_ACCOUNT_NAME=None,
                       AZURE_STORAGE_KEY=None)
    def test_azure_config_not_set(self):
        with mock.patch('azure_video_pipeline.models.AzureOrgProfile.objects.filter',
                        return_value=mock.Mock(first=mock.Mock(return_value=None))):
            with self.assertRaises(ImproperlyConfigured):
                get_azure_config('name_org')

    @mock.patch('azure_video_pipeline.utils.get_media_service_client', return_value=mock.Mock(
        get_input_asset_by_video_id=mock.Mock(return_value=[])
    ))
    def test_encrypt_file_when_video_file_corrupt(self, get_media_service_client):
        status = encrypt_file('video_id', 'org_name')
        get_media_service_client.assert_called_once_with('org_name')

        media_service = get_media_service_client()
        media_service.get_input_asset_by_video_id.assert_called_once_with('video_id', 'ENCODED')
        self.assertEqual(status, 'file_corrupt')

    @mock.patch('azure_video_pipeline.utils.get_media_service_client', return_value=mock.Mock(
        get_input_asset_by_video_id=mock.Mock(return_value={'Id': 'asset_id'}),
        get_asset_content_keys=mock.Mock(return_value={'Id': 'content_key_id'}),
    ))
    @mock.patch('azure_video_pipeline.utils.remove_access_policies_and_locators')
    @mock.patch('azure_video_pipeline.utils.create_content_key_and_associate_with_encoded_asset')
    @mock.patch('azure_video_pipeline.utils.create_authorization_policy_and_associate_with_content_key')
    @mock.patch('azure_video_pipeline.utils.create_delivery_policy_and_associate_with_encoded_asset')
    @mock.patch('azure_video_pipeline.utils.create_access_policies_and_locators')
    def test_encrypt_file_when_content_key_exists(self,
                                                  create_access_policies_and_locators,
                                                  create_delivery_policy_and_associate_with_encoded_asset,
                                                  create_authorization_policy_and_associate_with_content_key,
                                                  create_content_key_and_associate_with_encoded_asset,
                                                  remove_access_policies_and_locators,
                                                  get_media_service_client):
        status = encrypt_file('video_id', 'org_name')
        get_media_service_client.assert_called_once_with('org_name')

        media_service = get_media_service_client()
        media_service.get_input_asset_by_video_id.assert_called_once_with(
            'video_id',
            'ENCODED'
        )
        media_service.get_asset_content_keys.assert_called_once_with(
            'asset_id',
            ContentKeyType.ENVELOPE_ENCRYPTION
        )
        remove_access_policies_and_locators.assert_called_once_with(
            media_service,
            {'Id': 'asset_id'}
        )
        create_content_key_and_associate_with_encoded_asset.assert_not_called()
        create_authorization_policy_and_associate_with_content_key.assert_not_called()
        create_delivery_policy_and_associate_with_encoded_asset.assert_called_once_with(
            media_service,
            {'Id': 'asset_id'},
            {'Id': 'content_key_id'}
        )
        create_access_policies_and_locators.assert_called_once_with(
            media_service,
            {'Id': 'asset_id'}
        )
        self.assertEqual(status, 'file_encrypted')

    @mock.patch('azure_video_pipeline.utils.get_media_service_client', return_value=mock.Mock(
        get_input_asset_by_video_id=mock.Mock(return_value={'Id': 'asset_id'}),
        get_asset_content_keys=mock.Mock(return_value=None),
    ))
    @mock.patch('azure_video_pipeline.utils.remove_access_policies_and_locators')
    @mock.patch('azure_video_pipeline.utils.create_content_key_and_associate_with_encoded_asset',
                return_value={'Id': 'content_key_id'})
    @mock.patch('azure_video_pipeline.utils.create_authorization_policy_and_associate_with_content_key')
    @mock.patch('azure_video_pipeline.utils.create_delivery_policy_and_associate_with_encoded_asset')
    @mock.patch('azure_video_pipeline.utils.create_access_policies_and_locators')
    def test_encrypt_file_when_content_key_does_not_exist(self,
                                                          create_access_policies_and_locators,
                                                          create_delivery_policy_and_associate_with_encoded_asset,
                                                          create_authorization_policy_and_associate_with_content_key,
                                                          create_content_key_and_associate_with_encoded_asset,
                                                          remove_access_policies_and_locators,
                                                          get_media_service_client):
        status = encrypt_file('video_id', 'org_name')
        get_media_service_client.assert_called_once_with('org_name')

        media_service = get_media_service_client()
        media_service.get_input_asset_by_video_id.assert_called_once_with(
            'video_id',
            'ENCODED'
        )
        media_service.get_asset_content_keys.assert_called_once_with(
            'asset_id',
            ContentKeyType.ENVELOPE_ENCRYPTION
        )
        remove_access_policies_and_locators.assert_called_once_with(
            media_service,
            {'Id': 'asset_id'}
        )
        create_content_key_and_associate_with_encoded_asset.assert_called_once_with(
            media_service,
            {'Id': 'asset_id'}
        )
        create_authorization_policy_and_associate_with_content_key.assert_called_once_with(
            media_service,
            {'Id': 'content_key_id'}
        )
        create_delivery_policy_and_associate_with_encoded_asset.assert_called_once_with(
            media_service,
            {'Id': 'asset_id'},
            {'Id': 'content_key_id'}
        )
        create_access_policies_and_locators.assert_called_once_with(
            media_service,
            {'Id': 'asset_id'}
        )
        self.assertEqual(status, 'file_encrypted')

    @mock.patch('azure_video_pipeline.utils.remove_access_policies_and_locators')
    @mock.patch('azure_video_pipeline.utils.get_media_service_client', return_value=mock.Mock(
        get_input_asset_by_video_id=mock.Mock(return_value={'Id': 'asset_id'}),
        get_asset_content_keys=mock.Mock(return_value={'Id': 'content_key_id'}),
    ))
    def test_encrypt_file_http_error(self, get_media_service_client_mock,
                                     remove_access_policies_and_locators_mock):
        # arrange
        remove_access_policies_and_locators_mock.side_effect = HTTPError
        # act
        status = encrypt_file('video_id', 'org_name')
        # assert
        self.assertEqual(status, 'encryption_error')

    @mock.patch('azure_video_pipeline.utils.get_media_service_client', return_value=mock.Mock(
        get_input_asset_by_video_id=mock.Mock(return_value=[])
    ))
    def test_remove_encryption_when_video_file_corrupt(self, get_media_service_client):
        status = remove_encryption('video_id', 'org_name')
        get_media_service_client.assert_called_once_with('org_name')

        media_service = get_media_service_client()
        media_service.get_input_asset_by_video_id.assert_called_once_with('video_id', 'ENCODED')
        self.assertEqual(status, 'file_corrupt')

    @mock.patch('azure_video_pipeline.utils.get_media_service_client', return_value=mock.Mock(
        get_input_asset_by_video_id=mock.Mock(return_value={'Id': 'asset_id'}),
    ))
    @mock.patch('azure_video_pipeline.utils.remove_access_policies_and_locators')
    @mock.patch('azure_video_pipeline.utils.remove_delivery_policy_link_from_asset_and_delivery_policy')
    @mock.patch('azure_video_pipeline.utils.create_access_policies_and_locators')
    def test_remove_encryption(self,
                               create_access_policies_and_locators,
                               remove_delivery_policy_link_from_asset_and_delivery_policy,
                               remove_access_policies_and_locators,
                               get_media_service_client):
        status = remove_encryption('video_id', 'org_name')
        get_media_service_client.assert_called_once_with('org_name')

        media_service = get_media_service_client()
        media_service.get_input_asset_by_video_id.assert_called_once_with(
            'video_id',
            'ENCODED'
        )
        remove_access_policies_and_locators.assert_called_once_with(
            media_service,
            {'Id': 'asset_id'}
        )
        remove_delivery_policy_link_from_asset_and_delivery_policy.assert_called_once_with(
            media_service,
            {'Id': 'asset_id'}
        )
        create_access_policies_and_locators.assert_called_once_with(
            media_service,
            {'Id': 'asset_id'}
        )
        self.assertEqual(status, 'file_complete')

    @mock.patch('azure_video_pipeline.utils.remove_access_policies_and_locators')
    @mock.patch('azure_video_pipeline.utils.get_media_service_client', return_value=mock.Mock(
        get_input_asset_by_video_id=mock.Mock(return_value={'Id': 'asset_id'}),
        get_asset_content_keys=mock.Mock(return_value={'Id': 'content_key_id'}),
    ))
    def test_remove_encryption_http_error(self, get_media_service_client_mock,
                                          remove_access_policies_and_locators_mock):
        # arrange
        remove_access_policies_and_locators_mock.side_effect = HTTPError
        # act
        status = remove_encryption('video_id', 'org_name')
        # assert
        self.assertEqual(status, 'decryption_error')

    def test_remove_access_policies_and_locators(self):
        # arrange
        media_service = mock.Mock(
            get_asset_locators=mock.Mock(
                return_value=[
                    {'Id': 'locator_id_1', 'AccessPolicyId': 'access_policy_id_1'},
                    {'Id': 'locator_id_2', 'AccessPolicyId': ''}
                ]
            ),
            delete_access_policy=mock.Mock(),
            delete_locator=mock.Mock()
        )
        asset = {'Id': 'asset_id'}
        # act
        remove_access_policies_and_locators(media_service, asset)
        # assert
        media_service.get_asset_locators.assert_called_once_with(
            'asset_id'
        )
        media_service.delete_access_policy.assert_called_once_with(
            'access_policy_id_1'
        )
        media_service.delete_locator.assert_has_calls(
            [mock.call('locator_id_1'), mock.call('locator_id_2')]
        )
        self.assertEqual(media_service.delete_locator.call_count, 2)

    @mock.patch('azure_video_pipeline.utils.encrypt_content_key_with_public_key',
                return_value=('content_key', 'encrypted_content_key'))
    def test_create_content_key_and_associate_with_encoded_asset(self, encrypt_content_key_with_public_key):
        # arrange
        media_service = mock.Mock(
            get_protection_key_id=mock.Mock(return_value='protection_key_id'),
            get_protection_key=mock.Mock(return_value='protection_key'),
            create_content_key=mock.Mock(return_value={'Id': 'content_key_id'}),
            associate_content_key_with_asset=mock.Mock()
        )
        asset = {'Id': 'asset_id', 'Name': 'asset_name'}
        # act
        content_key = create_content_key_and_associate_with_encoded_asset(media_service, asset)
        # assert
        media_service.get_protection_key_id.assert_called_once_with(
            ContentKeyType.ENVELOPE_ENCRYPTION
        )
        media_service.get_protection_key.assert_called_once_with(
            'protection_key_id'
        )
        encrypt_content_key_with_public_key.assert_called_once_with(
            'protection_key'
        )
        media_service.create_content_key.assert_called_once_with(
            'ContentKey asset_name',
            'protection_key_id',
            ContentKeyType.ENVELOPE_ENCRYPTION,
            'encrypted_content_key'
        )
        media_service.associate_content_key_with_asset.assert_called_once_with(
            'asset_id',
            'content_key_id'
        )
        self.assertEqual(content_key, {'Id': 'content_key_id'})

    def test_create_authorization_policy_and_associate_with_content_key(self):
        # arrange
        media_service = mock.Mock(
            create_content_key_authorization_policy=mock.Mock(
                return_value={'Id': 'authorization_policy_id'}
            ),
            create_content_key_open_authorization_policy_options=mock.Mock(
                return_value={'Id': 'authorization_policy_option_id'}
            ),
            associate_authorization_policy_with_option=mock.Mock(),
            update_content_key=mock.Mock()
        )
        content_key = {'Id': 'content_key_id', 'Name': 'content_key_name'}
        # act
        create_authorization_policy_and_associate_with_content_key(media_service, content_key)
        # assert
        media_service.create_content_key_authorization_policy.assert_called_once_with(
            'Open Authorization Policy content_key_name'
        )
        media_service.create_content_key_open_authorization_policy_options.assert_called_once_with(
            'Authorization policy option',
            KeyDeliveryType.BASE_LINE_HTTP
        )
        media_service.associate_authorization_policy_with_option.assert_called_once_with(
            'authorization_policy_id',
            'authorization_policy_option_id'
        )
        media_service.update_content_key.assert_called_once_with(
            'content_key_id',
            data={"AuthorizationPolicyId": 'authorization_policy_id'}
        )

    def test_create_delivery_policy_and_associate_with_encoded_asset(self):
        # arrange
        media_service = mock.Mock(
            get_key_delivery_url=mock.Mock(
                return_value='https://mediaserviceaccount.keydelivery.westeurope.media.azure.net/?KID=ec739d79'
            ),
            create_asset_delivery_policy=mock.Mock(
                return_value={'Id': 'asset_delivery_policy_id'}
            ),
            associate_delivery_polic_with_asset=mock.Mock(),
        )
        asset = {'Id': 'asset_id', 'Name': 'asset_name'}
        content_key = {'Id': 'content_key_id'}
        # act
        create_delivery_policy_and_associate_with_encoded_asset(media_service, asset, content_key)
        # assert
        media_service.get_key_delivery_url.assert_called_once_with(
            'content_key_id',
            KeyDeliveryType.BASE_LINE_HTTP
        )
        asset_delivery_configuration = [{
            "Key": AssetDeliveryPolicyConfigurationKey.ENVELOPE_BASE_KEY_ACQUISITION_URL,
            "Value": "https://mediaserviceaccount.keydelivery.westeurope.media.azure.net/"
        }]
        media_service.create_asset_delivery_policy.assert_called_once_with(
            'AssetDeliveryPolicy asset_name',
            AssetDeliveryProtocol.ALL,
            AssetDeliveryPolicyType.DYNAMIC_ENVELOPE_ENCRYPTION,
            json.dumps(asset_delivery_configuration)
        )
        media_service.associate_delivery_polic_with_asset.assert_called_once_with(
            'asset_id',
            'asset_delivery_policy_id'
        )

    def test_create_access_policies_and_locators(self):
        # arrange
        media_service = mock.Mock(
            create_access_policy=mock.Mock(
                return_value={'Id': 'access_policy_id'}
            ),
            create_locator=mock.Mock()
        )
        asset = {'Id': 'asset_id'}
        # act
        create_access_policies_and_locators(media_service, asset)
        # assert
        media_service.create_access_policy.assert_called_once_with(
            'OpenEdxVideoPipelineAccessPolicy',
            duration_in_minutes=60 * 24 * 365 * 10,
            permissions=AccessPolicyPermissions.READ
        )
        media_service.create_locator.assert_has_calls(
            [mock.call('access_policy_id', 'asset_id', locator_type=LocatorTypes.OnDemandOrigin),
             mock.call('access_policy_id', 'asset_id', locator_type=LocatorTypes.SAS)]
        )
        self.assertEqual(media_service.create_locator.call_count, 2)

    def test_remove_delivery_policy_link_from_asset_and_delivery_policy(self):
        # arrange
        media_service = mock.Mock(
            get_asset_delivery_policies=mock.Mock(
                return_value=[{'Id': 'delivery_policy_id'}]
            ),
            delete_delivery_policy_link_from_asset=mock.Mock(),
            delete_delivery_policy=mock.Mock()
        )
        asset = {'Id': 'asset_id'}
        # act
        remove_delivery_policy_link_from_asset_and_delivery_policy(media_service, asset)
        # assert
        media_service.get_asset_delivery_policies.assert_called_once_with(
            'asset_id'
        )
        media_service.delete_delivery_policy_link_from_asset.assert_called_once_with(
            'asset_id',
            'delivery_policy_id'
        )
        media_service.delete_delivery_policy.assert_called_once_with(
            'delivery_policy_id'
        )

    def test_get_video_info(self):
        # arrange
        video = mock.Mock(client_video_id='video_name.mp4', status='file_complete')
        path_locator_on_demand = '//ma.streaming.mediaservices.windows.net/locator_id/'
        path_locator_sas = '//sa.blob.core.windows.net/asset-locator_id?sv=2012-02-12&sr=c'
        asset_files = [
            {
                "Name": "fileNameIsm.ism",
                "MimeType": "application/octet-stream",
                "ContentFileSize": 10
            },
            {
                "Name": "fileName_1.mp4",
                "MimeType": "video/mp4",
                "ContentFileSize": 10
            },
            {
                "Name": "fileName_2.mp4",
                "MimeType": "video/mp4",
                "ContentFileSize": 20
            }
        ]
        # act
        video_info = get_video_info(video, path_locator_on_demand, path_locator_sas, asset_files)

        # assert
        expected_video_info = {
            'smooth_streaming_url': '//ma.streaming.mediaservices.windows.net/locator_id/video_name.ism/manifest',
            'download_video_url': '//sa.blob.core.windows.net/asset-locator_id/fileName_2.mp4?sv=2012-02-12&sr=c'
        }

        self.assertEqual(video_info, expected_video_info)

    def test_get_video_info_if_path_locator_on_demand_is_not_defined(self):
        # arrange
        video = mock.Mock(client_video_id='video_name.mp4', status='file_complete')
        path_locator_on_demand = ''
        path_locator_sas = '//sa.blob.core.windows.net/asset-locator_id?sv=2012-02-12&sr=c'
        asset_files = [
            {
                "Name": "fileNameIsm.ism",
                "MimeType": "application/octet-stream",
                "ContentFileSize": 10
            },
            {
                "Name": "fileName_1.mp4",
                "MimeType": "video/mp4",
                "ContentFileSize": 10
            },
            {
                "Name": "fileName_2.mp4",
                "MimeType": "video/mp4",
                "ContentFileSize": 20
            }
        ]
        # act
        video_info = get_video_info(video, path_locator_on_demand, path_locator_sas, asset_files)

        # assert
        expected_video_info = {
            'smooth_streaming_url': '',
            'download_video_url': '//sa.blob.core.windows.net/asset-locator_id/fileName_2.mp4?sv=2012-02-12&sr=c'
        }
        self.assertEqual(video_info, expected_video_info)

    def test_get_video_info_if_path_locator_sas_is_not_defined(self):
        # arrange
        video = mock.Mock(client_video_id='video_name.mp4')
        path_locator_on_demand = '//ma.streaming.mediaservices.windows.net/locator_id/'
        path_locator_sas = ''
        asset_files = [
            {
                "Name": "fileNameIsm.ism",
                "MimeType": "application/octet-stream",
                "ContentFileSize": 10
            },
            {
                "Name": "fileName_1.mp4",
                "MimeType": "video/mp4",
                "ContentFileSize": 10
            },
            {
                "Name": "fileName_2.mp4",
                "MimeType": "video/mp4",
                "ContentFileSize": 20
            }
        ]
        # act
        video_info = get_video_info(video, path_locator_on_demand, path_locator_sas, asset_files)
        captions_info = get_captions_info(video, path_locator_sas)

        # assert
        expected_video_info = {
            'smooth_streaming_url': '//ma.streaming.mediaservices.windows.net/locator_id/video_name.ism/manifest',
            'download_video_url': ''
        }
        self.assertEqual(video_info, expected_video_info)
        self.assertEqual(captions_info, [])

    def test_drop_http_or_https(self):
        # act
        http_url = _drop_http_or_https('http://ma.streaming.mediaservices.windows.net/locator_id/')
        https_url = _drop_http_or_https('https://ma.streaming.mediaservices.windows.net/locator_id/')
        # assert
        self.assertEqual(http_url, '//ma.streaming.mediaservices.windows.net/locator_id/')
        self.assertEqual(https_url, '//ma.streaming.mediaservices.windows.net/locator_id/')

    @mock.patch('azure_video_pipeline.utils.Video.objects.get', side_effect=Video.DoesNotExist)
    def test_get_captions_and_video_info_if_video_doesNotExist(self, video_get):
        # act
        captions_and_video_info = get_captions_and_video_info('edx_video_id', 'org_name')

        # assert
        video_get.assert_called_once_with(edx_video_id='edx_video_id')
        self.assertEqual(
            captions_and_video_info,
            {'error_message': "Target Video is no longer available on Azure or is corrupted in some way.",
             'video_info': {},
             'captions': []}
        )

    @mock.patch('azure_video_pipeline.utils.Video.objects.get')
    @mock.patch('azure_video_pipeline.utils.get_media_service_client', return_value=mock.Mock(
        get_input_asset_by_video_id=mock.Mock(return_value=[])
    ))
    def test_get_captions_and_video_info_if_asset_doesNotExist(self, mock_media_service_client, video_get):
        # act
        captions_and_video_info = get_captions_and_video_info('edx_video_id', 'org_name')

        # assert
        video_get.assert_called_once_with(edx_video_id='edx_video_id')
        mock_media_service_client.assert_called_once_with('org_name')
        media_service = mock_media_service_client()
        media_service.get_input_asset_by_video_id.assert_called_once_with('edx_video_id', 'ENCODED')
        self.assertEqual(
            captions_and_video_info,
            {'error_message': "Target Video is no longer available on Azure or is corrupted in some way.",
             'video_info': {},
             'captions': []}
        )

    @mock.patch('azure_video_pipeline.utils.Video.objects.get')
    @mock.patch('azure_video_pipeline.utils.get_media_service_client', return_value=mock.Mock(
        get_input_asset_by_video_id=mock.Mock(return_value={'Id': 'asset_id'}),
        get_asset_locators=mock.Mock(return_value=None)
    ))
    def test_get_captions_and_video_info_if_locator_on_demand_doesNotExist(self, mock_media_service_client, video_get):
        # act
        captions_and_video_info = get_captions_and_video_info('edx_video_id', 'org_name')

        # assert
        video_get.assert_called_once_with(edx_video_id='edx_video_id')
        mock_media_service_client.assert_called_once_with('org_name')

        media_service = mock_media_service_client()
        media_service.get_input_asset_by_video_id.assert_called_once_with('edx_video_id', 'ENCODED')

        calls = [mock.call('asset_id', LocatorTypes.OnDemandOrigin), mock.call('asset_id', LocatorTypes.SAS)]
        media_service.get_asset_locators.assert_has_calls(calls)

        self.assertEqual(
            captions_and_video_info,
            {'error_message': "Target Video is no longer available on Azure or is corrupted in some way.",
             'video_info': {},
             'captions': []}
        )

    @mock.patch('azure_video_pipeline.utils.Video.objects.get', return_value='video_object')
    @mock.patch('azure_video_pipeline.utils.get_media_service_client', return_value=mock.Mock(
        get_input_asset_by_video_id=mock.Mock(return_value={'Id': 'asset_id'}),
        get_asset_locators=mock.Mock(side_effect=[{'Path': 'http_path_locator_on_demand'}, None])
    ))
    @mock.patch("azure_video_pipeline.utils._drop_http_or_https", return_value='path_locator_on_demand')
    @mock.patch("azure_video_pipeline.utils.get_video_info", return_value='video_info')
    def test_get_captions_and_video_info_if_locator_sas_doesNotExist(self,
                                                                     mock_video_info,
                                                                     drop_http_or_https,
                                                                     mock_media_service_client,
                                                                     video_get):
        # act
        captions_and_video_info = get_captions_and_video_info('edx_video_id', 'org_name')

        # assert
        video_get.assert_called_once_with(edx_video_id='edx_video_id')
        mock_media_service_client.assert_called_once_with('org_name')

        media_service = mock_media_service_client()
        media_service.get_input_asset_by_video_id.assert_called_once_with('edx_video_id', 'ENCODED')

        calls = [mock.call('asset_id', LocatorTypes.OnDemandOrigin), mock.call('asset_id', LocatorTypes.SAS)]
        media_service.get_asset_locators.assert_has_calls(calls)

        drop_http_or_https.assert_called_once_with('http_path_locator_on_demand')
        mock_video_info.assert_called_once_with(
            'video_object',
            'path_locator_on_demand',
            None,
            None
        )

        self.assertEqual(
            captions_and_video_info,
            {'error_message': "To be able to use captions/transcripts auto-fetching, "
                              "AMS Asset should be published properly "
                              "(in addition to 'streaming' locator a 'progressive' "
                              "locator must be created as well).",
             'video_info': 'video_info',
             'captions': []}
        )

    @mock.patch('azure_video_pipeline.utils.Video.objects.get', return_value='video_object')
    @mock.patch('azure_video_pipeline.utils.get_media_service_client', return_value=mock.Mock(
        get_input_asset_by_video_id=mock.Mock(return_value={'Id': 'asset_id'}),
        get_asset_locators=mock.Mock(side_effect=[{'Path': 'http_path_locator_on_demand'},
                                                  {'Path': 'http_path_locator_sas'}]),
        get_asset_files=mock.Mock(return_value='asset_files')
    ))
    @mock.patch("azure_video_pipeline.utils._drop_http_or_https", side_effect=['path_locator_on_demand',
                                                                               'path_locator_sas'])
    @mock.patch("azure_video_pipeline.utils.get_captions_info", return_value='captions_info')
    @mock.patch("azure_video_pipeline.utils.get_video_info", return_value='video_info')
    def test_basic_functional_get_captions_and_video_info(self,
                                                          mock_video_info,
                                                          mock_captions_info,
                                                          drop_http_or_https,
                                                          mock_media_service_client,
                                                          video_get):
        # act
        captions_and_video_info = get_captions_and_video_info('edx_video_id', 'org_name')

        # assert
        video_get.assert_called_once_with(edx_video_id='edx_video_id')
        mock_media_service_client.assert_called_once_with('org_name')

        media_service = mock_media_service_client()
        media_service.get_input_asset_by_video_id.assert_called_once_with('edx_video_id', 'ENCODED')

        calls_locators = [mock.call('asset_id', LocatorTypes.OnDemandOrigin), mock.call('asset_id', LocatorTypes.SAS)]
        media_service.get_asset_locators.assert_has_calls(calls_locators)

        calls_drop = [mock.call('http_path_locator_on_demand'), mock.call('http_path_locator_sas')]
        drop_http_or_https.assert_has_calls(calls_drop)
        mock_captions_info.assert_called_once_with(
            'video_object',
            'path_locator_sas'
        )
        mock_video_info.assert_called_once_with(
            'video_object',
            'path_locator_on_demand',
            'path_locator_sas',
            'asset_files'
        )

        self.assertEqual(
            captions_and_video_info,
            {'error_message': '',
             'video_info': 'video_info',
             'captions': 'captions_info'}
        )

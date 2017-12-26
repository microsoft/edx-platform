import unittest

from azure_video_pipeline.utils import (
    get_azure_config, get_media_service_client
)
import mock


class UtilsTests(unittest.TestCase):

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
            with mock.patch.dict('azure_video_pipeline.utils.settings.FEATURES', {
                'AZURE_CLIENT_ID': 'client_id',
                'AZURE_CLIENT_SECRET': 'client_secret',
                'AZURE_TENANT': 'tenant',
                'AZURE_REST_API_ENDPOINT': 'rest_api_endpoint',
                'STORAGE_ACCOUNT_NAME': 'account_name',
                'STORAGE_KEY': 'key'
            }):
                azure_config = get_azure_config('name_org')

                expected_azure_config = {
                    'client_id': 'client_id',
                    'secret': 'client_secret',
                    'tenant': 'tenant',
                    'rest_api_endpoint': 'rest_api_endpoint',
                    'storage_account_name': 'account_name',
                    'storage_key': 'key'
                }
                self.assertEqual(azure_config, expected_azure_config)

    def test_when_not_set_azure_config(self):
        with mock.patch('azure_video_pipeline.models.AzureOrgProfile.objects.filter',
                        return_value=mock.Mock(first=mock.Mock(return_value=None))):
            with mock.patch.dict('azure_video_pipeline.utils.settings.FEATURES', {}):
                azure_config = get_azure_config('name_org')
                self.assertEqual(azure_config, {})

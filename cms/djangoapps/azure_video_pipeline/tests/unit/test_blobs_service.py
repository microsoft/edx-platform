import unittest

from azure.storage.blob import BlobSharedAccessPermissions
from azure_video_pipeline.blobs_service import BlobServiceClient
from freezegun import freeze_time
import mock


class BlobServiceClientTests(unittest.TestCase):

    @mock.patch('azure_video_pipeline.blobs_service.CloudStorageAccount')
    def make_one(self, cloud_storage_account):
        blobs_service_client = BlobServiceClient('account_name', 'account_key')
        blobs_service_client.blob_service = mock.Mock(
            generate_shared_access_signature=mock.Mock(return_value='sas_token'),
            make_blob_url=mock.Mock(return_value='sas_url')
        )
        return blobs_service_client

    @mock.patch('azure_video_pipeline.blobs_service.BlobServiceClient.get_shared_access_policy',
                return_value={'id': 'shared_access_policy'})
    def test_generate_url(self, get_shared_access_policy):
        blobs_service_client = self.make_one()
        sas_url = blobs_service_client.generate_url('uid:asset_id', 'blob_name', 123456789)

        get_shared_access_policy.assert_called_once_with(
            BlobSharedAccessPermissions.WRITE,
            123456789
        )
        blobs_service_client.blob_service.generate_shared_access_signature.assert_called_once_with(
            'asset-asset_id',
            'blob_name',
            {'id': 'shared_access_policy'}
        )
        blobs_service_client.blob_service.make_blob_url.assert_called_once_with(
            'asset-asset_id',
            'blob_name',
            sas_token='sas_token')
        self.assertEqual(sas_url, 'sas_url')

    @mock.patch('azure_video_pipeline.blobs_service.SharedAccessPolicy',
                return_value={'id': 'shared_access_policy'})
    @mock.patch('azure_video_pipeline.blobs_service.AccessPolicy',
                return_value={'id': 'access_policy'})
    @freeze_time("2017-11-01")
    def test_get_shared_access_policy(self, access_policy, shared_access_policy):
        blobs_service_client = self.make_one()
        shared_access_policy_obj = blobs_service_client.get_shared_access_policy(
            BlobSharedAccessPermissions.WRITE,
            86400
        )

        shared_access_policy.assert_called_once_with(
            {'id': 'access_policy'}
        )
        access_policy.assert_called_once_with(
            '2017-10-31T23:59:00Z',
            '2017-11-01T23:59:00Z',
            'w'
        )
        self.assertEqual(shared_access_policy_obj, {'id': 'shared_access_policy'})

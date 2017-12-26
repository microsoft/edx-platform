from datetime import datetime, timedelta

from azure.storage import AccessPolicy, CloudStorageAccount, SharedAccessPolicy
from azure.storage.blob import BlobSharedAccessPermissions


class BlobServiceClient(object):

    def __init__(self, account_name, account_key):
        storage_client = CloudStorageAccount(account_name, account_key)
        self.blob_service = storage_client.create_blob_service()

    def generate_url(self, asset_id, blob_name, expires_in):
        sas_policy = self.get_shared_access_policy(BlobSharedAccessPermissions.WRITE, expires_in)
        container_name = 'asset-{}'.format(asset_id.split(':')[-1])
        sas_token = self.blob_service.generate_shared_access_signature(container_name, blob_name, sas_policy)
        sas_url = self.blob_service.make_blob_url(container_name, blob_name, sas_token=sas_token)
        return sas_url

    def get_shared_access_policy(self, permission, expires_in):
        date_format = "%Y-%m-%dT%H:%M:%SZ"
        start = datetime.utcnow() - timedelta(minutes=1)
        expiry = start + timedelta(seconds=expires_in)
        return SharedAccessPolicy(
            AccessPolicy(
                start.strftime(date_format),
                expiry.strftime(date_format),
                permission,
            )
        )

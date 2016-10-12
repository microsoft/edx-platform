"""
Django storage backends for Open edX.
"""

import pytz
from datetime import datetime, timedelta

from django.contrib.staticfiles.storage import StaticFilesStorage, CachedFilesMixin
from pipeline.storage import PipelineMixin, NonPackagingMixin

from django.core.files.storage import get_storage_class
from django.utils.lru_cache import lru_cache

from require.storage import OptimizedFilesMixin

from storages.backends.azure_storage import AzureStorage
from azure.storage import AccessPolicy, SharedAccessPolicy

class ProductionStorage(
        OptimizedFilesMixin,
        PipelineMixin,
        CachedFilesMixin,
        StaticFilesStorage
):
    """
    This class combines Django's StaticFilesStorage class with several mixins
    that provide additional functionality. We use this version on production.
    """
    pass


class DevelopmentStorage(
        NonPackagingMixin,
        PipelineMixin,
        StaticFilesStorage
):
    """
    This class combines Django's StaticFilesStorage class with several mixins
    that provide additional functionality. We use this version for development,
    so that we can skip packaging and optimization.
    """
    pass


@lru_cache()
def get_storage(storage_class=None, **kwargs):
    """
    Returns a storage instance with the given class name and kwargs. If the
    class name is not given, an instance of the default storage is returned.
    Instances are cached so that if this function is called multiple times
    with the same arguments, the same instance is returned. This is useful if
    the storage implementation makes http requests when instantiated, for
    example.
    """
    return get_storage_class(storage_class)(**kwargs)


class AzureStorageExtended(AzureStorage):
    """
    A wrapper around the django-stores implementation for Azzure blob storage
    so that it is fully comptaible. The version in the library's repository
    is out of date
    """

    def __init__(self, container=None, url_expiry_secs=None, *args, **kwargs):
        """
        Override base implementation so that we can accept a container
        parameter and an expiration on urls
        """
        super(AzureStorage, self).__init__(*args, **kwargs)
        self._connection = None
        self.url_expiry_secs = url_expiry_secs

        if container:
            self.azure_container = container

    def url(self, name):
        """
        Override this method so that we can add SAS authorization tokens
        """

        sas_token = None
        if self.url_expiry_secs:
            now = datetime.utcnow().replace(tzinfo=pytz.utc)
            expire_at = now + timedelta(seconds=self.url_expiry_secs)

            policy = AccessPolicy()
            # generate an ISO8601 time string and use split() to remove the sub-second
            # components as Azure will reject them. Plus add the timezone at the end.
            policy.expiry = expire_at.isoformat().split('.')[0] + 'Z'
            policy.permission = 'r'

            sas_token = self.connection.generate_shared_access_signature(
                self.azure_container,
                blob_name=name,
                shared_access_policy=SharedAccessPolicy(access_policy=policy),
            )

        return self.connection.make_blob_url(
            container_name=self.azure_container,
            blob_name=name,
            protocol=self.azure_protocol,
            sas_token=sas_token
        )

    def listdir(self, path):
        """
        The base implementation does not have a definition for this method
        which Open edX requires
        """
        if not path:
            path = None

        blobs = self.connection.list_blobs(
            container_name=self.azure_container,
            prefix=path,
        )
        results = []
        for f in blobs:
            name = f.name
            if path:
                name = name.replace(path, '')
            results.append(name)

        return ((), results)

from django.db import models
from django.dispatch import receiver
from django.utils.encoding import python_2_unicode_compatible
from django.utils.translation import ugettext_lazy as _
from edxval.models import Video
from organizations.models import Organization


@python_2_unicode_compatible
class AzureOrgProfile(models.Model):
    """
    Azure services API-related extensions for Organization.
    """

    organization = models.OneToOneField(Organization)
    client_id = models.CharField(
        max_length=255,
        help_text=_('The client ID of the Azure AD application')
    )
    client_secret = models.CharField(
        max_length=255,
        help_text=_('The client key of the Azure AD application')
    )
    tenant = models.CharField(
        max_length=255,
        help_text=_('The Azure AD tenant domain where the Azure AD application resides')
    )
    rest_api_endpoint = models.URLField(
        max_length=255,
        help_text=_('The REST API endpoint of the Azure Media service account')
    )
    storage_account_name = models.CharField(
        max_length=255,
        help_text=_('Azure Blobs service storage account name')
    )
    storage_key = models.CharField(
        max_length=255,
        help_text=_('Azure Blobs service storage account key')
    )

    def __str__(self):
        return "AzureProfile [ORG={}]".format(self.organization.short_name)

    def to_dict(self):
        return {
            'client_id': self.client_id,
            'secret': self.client_secret,
            'tenant': self.tenant,
            'rest_api_endpoint': self.rest_api_endpoint,
            'storage_account_name': self.storage_account_name,
            'storage_key': self.storage_key
        }


@receiver(models.signals.post_save, sender=Video)
def video_status_update_callback(sender, **kwargs):  # pylint: disable=unused-argument
    from .jobs import signal_video_status_update_callback
    signal_video_status_update_callback(sender, **kwargs)

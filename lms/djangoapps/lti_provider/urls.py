"""
LTI Provider API endpoint urls.
"""

from django.conf import settings
from django.conf.urls import url

from lti_provider import views

urlpatterns = [
    url(r'^users/social_auth_mapping/', 'lti_provider.views.users_social_auth_mapping', name='lti_provider_social_auth_mapping'),
    url(
        r'^courses/{course_id}/{usage_id}$'.format(
            course_id=settings.COURSE_ID_PATTERN,
            usage_id=settings.USAGE_ID_PATTERN
        ),
        views.lti_launch, name="lti_provider_launch"),
]

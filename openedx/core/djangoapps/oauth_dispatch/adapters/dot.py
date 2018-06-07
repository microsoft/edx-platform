"""
Adapter to isolate django-oauth-toolkit dependencies
"""

from openedx.core.djangoapps.oauth_dispatch import models


class DOTAdapter(object):
    """
    Standard interface for working with django-oauth-toolkit
    """

    backend = object()

    def create_confidential_client(self,
                                   name,
                                   user,
                                   redirect_uri,
                                   client_id=None,
                                   authorization_grant_type=models.ScopedApplication.GRANT_AUTHORIZATION_CODE):
        """
        Create an oauth client application that is confidential.
        """
        return models.ScopedApplication.objects.create(
            name=name,
            user=user,
            client_id=client_id,
            client_type=models.ScopedApplication.CLIENT_CONFIDENTIAL,
            authorization_grant_type=authorization_grant_type,
            redirect_uris=redirect_uri,
        )

    def create_public_client(self, name, user, redirect_uri, client_id=None):
        """
        Create an oauth client application that is public.
        """
        return models.ScopedApplication.objects.create(
            name=name,
            user=user,
            client_id=client_id,
            client_type=models.ScopedApplication.CLIENT_PUBLIC,
            authorization_grant_type=models.ScopedApplication.GRANT_PASSWORD,
            redirect_uris=redirect_uri,
        )

    def get_client(self, **filters):
        """
        Get the oauth client application with the specified filters.

        Wraps django's queryset.get() method.
        """
        return models.ScopedApplication.objects.get(**filters)

    def get_client_for_token(self, token):
        """
        Given an AccessToken object, return the associated client application.
        """
        return token.application

    def get_access_token(self, token_string):
        """
        Given a token string, return the matching AccessToken object.
        """
        return models.AccessToken.objects.get(token=token_string)

    def normalize_scopes(self, scopes):
        """
        Given a list of scopes, return a space-separated list of those scopes.
        """
        if not scopes:
            scopes = ['default']
        return ' '.join(scopes)

    def get_token_scope_names(self, token):
        """
        Given an access token object, return its scopes.
        """
        return list(token.scopes)

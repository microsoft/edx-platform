import unittest

from django.contrib.sites.models import Site

from third_party_auth.tests import testutil
from third_party_auth import strategy


class StrategyTest(testutil.TestCase):
    def test_visible_provider(self):
        strtg = strategy.ConfigurationModelStrategy(None)
        gp = self.configure_google_provider(enabled=True, visible=True)

        try:
            strtg.setting("MAX_SESSION_LENGTH", backend=gp.backend_class())
        except Exception:
            raise self.failureException('Backend should be visible')

        gp.visible = False
        gp.save()

        with self.assertRaisesMessage(Exception, "Can't fetch setting of a disabled backend/provider."):
            strtg.setting("MAX_SESSION_LENGTH", backend=gp.backend_class())
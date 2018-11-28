from django.contrib import admin

from .models import AzureOrgProfile


class AzureOrgProfileAdmin(admin.ModelAdmin):
    list_display = ('organization', )


admin.site.register(AzureOrgProfile, AzureOrgProfileAdmin)

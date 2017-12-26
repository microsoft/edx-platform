# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('organizations', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='AzureOrgProfile',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('client_id', models.CharField(help_text='The client ID of the Azure AD application', max_length=255)),
                ('client_secret', models.CharField(help_text='The client key of the Azure AD application', max_length=255)),
                ('tenant', models.CharField(help_text='The Azure AD tenant domain where the Azure AD application resides', max_length=255)),
                ('rest_api_endpoint', models.URLField(help_text='The REST API endpoint of the Azure Media service account', max_length=255)),
                ('storage_account_name', models.CharField(help_text='Azure Blobs service storage account name', max_length=255)),
                ('storage_key', models.CharField(help_text='Azure Blobs service storage account key', max_length=255)),
                ('organization', models.OneToOneField(to='organizations.Organization')),
            ],
        ),
    ]

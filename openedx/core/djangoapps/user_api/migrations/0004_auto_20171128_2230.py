# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('user_api', '0003_auto_20171127_0934'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='deleteduserid',
            name='user',
        ),
        migrations.DeleteModel(
            name='DeletedUserID',
        ),
    ]

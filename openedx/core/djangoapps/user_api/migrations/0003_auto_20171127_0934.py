# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import datetime


class Migration(migrations.Migration):

    dependencies = [
        ('user_api', '0002_deleteduserid'),
    ]

    operations = [
        migrations.AlterField(
            model_name='deleteduserid',
            name='deleted_datetime',
            field=models.DateTimeField(default=datetime.datetime(2017, 11, 27, 9, 34, 8, 648756), null=True, blank=True),
        ),
    ]

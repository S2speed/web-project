import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def migrate_legacy_settings(apps, schema_editor):
    CustomUser = apps.get_model('users', 'CustomUser')
    UserSettings = apps.get_model('users', 'UserSettings')
    rows = []
    for user in CustomUser.objects.all():
        legacy = user.notification_settings or {}
        try:
            daily_limit = int(legacy.get('dailyLimit', legacy.get('daily_limit', 10)))
        except (TypeError, ValueError):
            daily_limit = 10
        daily_limit = min(50, max(0, daily_limit))
        language = legacy.get('language', 'fa')
        if language not in ('fa', 'en'):
            language = 'fa'
        rows.append(UserSettings(
            user_id=user.id,
            notification_in_app=legacy.get('inApp', legacy.get('in_app', True)),
            notification_push=legacy.get('push', True),
            notification_email=legacy.get('email', True),
            notification_daily_limit=daily_limit,
            app_sound=legacy.get('appSound', legacy.get('app_sound', True)),
            language=language,
        ))
    UserSettings.objects.bulk_create(rows, ignore_conflicts=True)


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0002_alter_customuser_managers'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='subscription_expires_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name='UserSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('notification_in_app', models.BooleanField(default=True)),
                ('notification_push', models.BooleanField(default=True)),
                ('notification_email', models.BooleanField(default=True)),
                ('notification_daily_limit', models.PositiveSmallIntegerField(default=10, validators=[django.core.validators.MinValueValidator(0), django.core.validators.MaxValueValidator(50)])),
                ('app_sound', models.BooleanField(default=True)),
                ('language', models.CharField(choices=[('fa', 'Persian'), ('en', 'English')], default='fa', max_length=5)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='app_settings', to=settings.AUTH_USER_MODEL)),
            ],
            options={'verbose_name': 'user setting', 'verbose_name_plural': 'user settings'},
        ),
        migrations.RunPython(migrate_legacy_settings, migrations.RunPython.noop),
    ]

from django.db import migrations, models


def initialize_read_timestamps(apps, schema_editor):
    Notification = apps.get_model('support', 'Notification')
    for notification in Notification.objects.filter(is_read=True, read_at__isnull=True):
        notification.read_at = notification.updated_at
        notification.save(update_fields=['read_at'])


class Migration(migrations.Migration):
    dependencies = [
        ('support', '0002_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='notification',
            name='dedupe_key',
            field=models.CharField(blank=True, max_length=160),
        ),
        migrations.AddField(
            model_name='notification',
            name='read_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='notification',
            name='link',
            field=models.CharField(blank=True, max_length=500, null=True),
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['user', 'is_read', 'created_at'], name='notification_user_state_idx'),
        ),
        migrations.AddConstraint(
            model_name='notification',
            constraint=models.UniqueConstraint(condition=~models.Q(dedupe_key=''), fields=('user', 'dedupe_key'), name='unique_user_notification_dedupe_key'),
        ),
        migrations.RunPython(initialize_read_timestamps, migrations.RunPython.noop),
    ]

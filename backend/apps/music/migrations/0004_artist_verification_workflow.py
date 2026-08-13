import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def initialize_verification_status(apps, schema_editor):
    Artist = apps.get_model('music', 'Artist')
    for artist in Artist.objects.select_related('user'):
        if artist.is_verified:
            artist.verification_status = 'approved'
            artist.verified_by_id = artist.user.verified_by_id
        elif artist.user.rejection_reason:
            artist.verification_status = 'rejected'
            artist.verification_reason = artist.user.rejection_reason
        artist.save(update_fields=[
            'verification_status', 'verification_reason', 'verified_by',
        ])


class Migration(migrations.Migration):
    dependencies = [
        ('music', '0003_phase3_playlists_queue_streams'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='artist',
            name='verification_status',
            field=models.CharField(
                choices=[('pending', 'pending'), ('approved', 'approved'), ('rejected', 'rejected')],
                db_index=True,
                default='pending',
                max_length=12,
            ),
        ),
        migrations.AddField(
            model_name='artist',
            name='verification_reason',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='artist',
            name='verified_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='artist_verification_decisions',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(initialize_verification_status, migrations.RunPython.noop),
    ]

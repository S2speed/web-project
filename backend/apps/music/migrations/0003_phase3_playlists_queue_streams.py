import django.core.validators
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


def copy_playlist_tracks(apps, schema_editor):
    Playlist = apps.get_model('music', 'Playlist')
    PlaylistTrack = apps.get_model('music', 'PlaylistTrack')
    tracks = []
    for playlist in Playlist.objects.all().iterator():
        for position, song in enumerate(playlist.songs.all().order_by('id')):
            tracks.append(PlaylistTrack(playlist_id=playlist.id, song_id=song.id, position=position))
    PlaylistTrack.objects.bulk_create(tracks)


class Migration(migrations.Migration):

    dependencies = [
        ('music', '0002_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PlaylistTrack',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('position', models.PositiveIntegerField(validators=[django.core.validators.MinValueValidator(0)])),
                ('added_at', models.DateTimeField(auto_now_add=True)),
                ('playlist', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tracks', to='music.playlist')),
                ('song', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='playlist_tracks', to='music.song')),
            ],
            options={'ordering': ['position', 'id']},
        ),
        migrations.AddConstraint(
            model_name='playlisttrack',
            constraint=models.UniqueConstraint(fields=('playlist', 'song'), name='unique_song_per_playlist'),
        ),
        migrations.AddConstraint(
            model_name='playlisttrack',
            constraint=models.UniqueConstraint(fields=('playlist', 'position'), name='unique_playlist_track_position'),
        ),
        migrations.RunPython(copy_playlist_tracks, migrations.RunPython.noop),
        migrations.RemoveField(model_name='playlist', name='songs'),
        migrations.AddField(
            model_name='playlist',
            name='songs',
            field=models.ManyToManyField(blank=True, related_name='playlists', through='music.PlaylistTrack', to='music.song'),
        ),
        migrations.CreateModel(
            name='PlaybackQueue',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('current_index', models.PositiveIntegerField(default=0)),
                ('repeat_mode', models.CharField(choices=[('none', 'none'), ('all', 'all'), ('one', 'one')], default='none', max_length=8)),
                ('shuffle', models.BooleanField(default=False)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='playback_queue', to=settings.AUTH_USER_MODEL)),
            ],
            options={'verbose_name': 'playback queue', 'verbose_name_plural': 'playback queues'},
        ),
        migrations.CreateModel(
            name='QueueItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('position', models.PositiveIntegerField(validators=[django.core.validators.MinValueValidator(0)])),
                ('added_at', models.DateTimeField(auto_now_add=True)),
                ('queue', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='music.playbackqueue')),
                ('song', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='queue_items', to='music.song')),
            ],
            options={'ordering': ['position', 'id']},
        ),
        migrations.AddConstraint(
            model_name='queueitem',
            constraint=models.UniqueConstraint(fields=('queue', 'position'), name='unique_queue_item_position'),
        ),
        migrations.CreateModel(
            name='StreamEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('source', models.CharField(choices=[('direct', 'direct'), ('album', 'album'), ('playlist', 'playlist'), ('queue', 'queue')], default='direct', max_length=12)),
                ('idempotency_key', models.CharField(blank=True, max_length=64)),
                ('played_at', models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ('song', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='stream_events', to='music.song')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='stream_events', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-played_at', '-id'],
                'indexes': [
                    models.Index(fields=['user', 'played_at'], name='stream_user_played_idx'),
                    models.Index(fields=['song', 'played_at'], name='stream_song_played_idx'),
                ],
            },
        ),
        migrations.AddConstraint(
            model_name='streamevent',
            constraint=models.UniqueConstraint(condition=~models.Q(idempotency_key=''), fields=('user', 'idempotency_key'), name='unique_user_stream_idempotency_key'),
        ),
    ]

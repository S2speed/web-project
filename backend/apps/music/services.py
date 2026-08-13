"""Domain services for playlists, playback queues, and stream accounting."""

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import Artist, PlaybackQueue, PlaylistTrack, QueueItem, Song, StreamEvent


def _normalize_positions(items, position_field='position'):
    """Persist contiguous positions without tripping unique position constraints."""

    items = list(items)
    if not items:
        return
    model = type(items[0])
    offset = len(items) + 1000
    for item in items:
        setattr(item, position_field, getattr(item, position_field) + offset)
    model.objects.bulk_update(items, [position_field])
    for position, item in enumerate(items):
        setattr(item, position_field, position)
    model.objects.bulk_update(items, [position_field])


@transaction.atomic
def add_playlist_track(playlist, song):
    if PlaylistTrack.objects.filter(playlist=playlist, song=song).exists():
        raise ValidationError({'song_id': 'This song is already in the playlist.'})
    position = playlist.tracks.count()
    return PlaylistTrack.objects.create(playlist=playlist, song=song, position=position)


@transaction.atomic
def remove_playlist_track(playlist, song):
    deleted, _ = PlaylistTrack.objects.filter(playlist=playlist, song=song).delete()
    if not deleted:
        raise ValidationError({'song_id': 'This song is not in the playlist.'})
    _normalize_positions(playlist.tracks.order_by('position', 'id'))


@transaction.atomic
def reorder_playlist_tracks(playlist, song_ids):
    tracks = list(playlist.tracks.select_for_update().order_by('position', 'id'))
    current_ids = [track.song_id for track in tracks]
    if len(song_ids) != len(set(song_ids)) or set(song_ids) != set(current_ids):
        raise ValidationError({'song_ids': 'Provide every playlist song exactly once.'})
    by_song = {track.song_id: track for track in tracks}
    ordered = [by_song[song_id] for song_id in song_ids]
    _normalize_positions(ordered)


def get_or_create_queue(user):
    queue, _ = PlaybackQueue.objects.get_or_create(user=user)
    return queue


@transaction.atomic
def replace_queue(user, song_ids, current_index=0, repeat_mode='none', shuffle=False):
    songs = list(Song.objects.filter(id__in=song_ids))
    songs_by_id = {song.id: song for song in songs}
    if len(songs_by_id) != len(set(song_ids)):
        raise ValidationError({'song_ids': 'One or more songs were not found.'})

    queue = get_or_create_queue(user)
    queue.items.all().delete()
    QueueItem.objects.bulk_create([
        QueueItem(queue=queue, song=songs_by_id[song_id], position=position)
        for position, song_id in enumerate(song_ids)
    ])
    max_index = max(len(song_ids) - 1, 0)
    queue.current_index = min(max(int(current_index), 0), max_index)
    queue.repeat_mode = repeat_mode
    queue.shuffle = bool(shuffle)
    queue.save(update_fields=['current_index', 'repeat_mode', 'shuffle', 'updated_at'])
    return queue


@transaction.atomic
def add_queue_item(user, song):
    queue = get_or_create_queue(user)
    return QueueItem.objects.create(queue=queue, song=song, position=queue.items.count())


@transaction.atomic
def remove_queue_item(user, item_id):
    queue = get_or_create_queue(user)
    try:
        item = queue.items.get(id=item_id)
    except QueueItem.DoesNotExist as exc:
        raise ValidationError({'item_id': 'Queue item was not found.'}) from exc
    removed_position = item.position
    item.delete()
    _normalize_positions(queue.items.order_by('position', 'id'))
    remaining = queue.items.count()
    if removed_position < queue.current_index:
        queue.current_index -= 1
    queue.current_index = min(queue.current_index, max(remaining - 1, 0))
    queue.save(update_fields=['current_index', 'updated_at'])
    return queue


@transaction.atomic
def reorder_queue(user, item_ids, current_index=None):
    queue = get_or_create_queue(user)
    items = list(queue.items.select_for_update().order_by('position', 'id'))
    current_ids = [item.id for item in items]
    if len(item_ids) != len(set(item_ids)) or set(item_ids) != set(current_ids):
        raise ValidationError({'item_ids': 'Provide every queue item exactly once.'})
    by_id = {item.id: item for item in items}
    current_item_id = items[queue.current_index].id if items and queue.current_index < len(items) else None
    _normalize_positions([by_id[item_id] for item_id in item_ids])
    if current_index is not None:
        queue.current_index = min(max(int(current_index), 0), max(len(items) - 1, 0))
    elif current_item_id is not None:
        queue.current_index = item_ids.index(current_item_id)
    queue.save(update_fields=['current_index', 'updated_at'])
    return queue


@transaction.atomic
def record_stream(*, user, song, source='direct', idempotency_key=''):
    """Record one stream atomically and enforce the subscription's daily limit."""

    locked_user = type(user).objects.select_for_update().get(pk=user.pk)
    locked_song = Song.objects.select_for_update().select_related('artist').get(pk=song.pk)

    if idempotency_key:
        existing = StreamEvent.objects.filter(
            user=locked_user,
            idempotency_key=idempotency_key,
        ).first()
        if existing:
            if existing.song_id != locked_song.id:
                raise ValidationError({'idempotency_key': 'This key was already used for another song.'})
            return existing, False

    today = timezone.localdate()
    streams_today = StreamEvent.objects.filter(user=locked_user, played_at__date=today).count()
    daily_limit = locked_user.subscription_limit.get('max_daily_streams')
    if daily_limit is not None and streams_today >= daily_limit:
        raise PermissionDenied(
            f'Daily stream limit reached ({daily_limit}). Upgrade your subscription to continue.'
        )

    event = StreamEvent.objects.create(
        user=locked_user,
        song=locked_song,
        source=source,
        idempotency_key=idempotency_key,
    )

    is_new_listener = not locked_song.listeners.filter(pk=locked_user.pk).exists()
    locked_song.listeners.add(locked_user)
    Song.objects.filter(pk=locked_song.pk).update(
        play_count=F('play_count') + 1,
        listener_count=F('listener_count') + (1 if is_new_listener else 0),
    )
    Artist.objects.filter(pk=locked_song.artist_id).update(total_streams=F('total_streams') + 1)
    unique_artist_listeners = StreamEvent.objects.filter(
        song__artist_id=locked_song.artist_id,
    ).values('user_id').distinct().count()
    Artist.objects.filter(pk=locked_song.artist_id).update(total_listeners=unique_artist_listeners)

    type(user).objects.filter(pk=locked_user.pk).update(
        daily_streams=streams_today + 1,
        total_streams=F('total_streams') + 1,
    )
    return event, True

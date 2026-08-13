from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.users.models import UserSettings

from .models import Notification


def get_user_settings(user):
    """Return persisted settings, importing legacy JSON for old accounts once."""
    legacy = user.notification_settings or {}
    try:
        daily_limit = int(legacy.get('dailyLimit', legacy.get('daily_limit', 10)))
    except (TypeError, ValueError):
        daily_limit = 10
    daily_limit = min(50, max(0, daily_limit))
    language = legacy.get('language', 'fa')
    if language not in ('fa', 'en'):
        language = 'fa'
    defaults = {
        'notification_in_app': legacy.get('inApp', legacy.get('in_app', True)),
        'notification_push': legacy.get('push', True),
        'notification_email': legacy.get('email', True),
        'notification_daily_limit': daily_limit,
        'app_sound': legacy.get('appSound', legacy.get('app_sound', True)),
        'language': language,
    }
    settings_obj, _ = UserSettings.objects.get_or_create(user=user, defaults=defaults)
    return settings_obj


def create_notification(
    *, user, type, title, message, link=None, dedupe_key='', respect_preferences=True,
):
    """Create a bounded, deduplicated in-app notification for one user."""
    if respect_preferences:
        preferences = get_user_settings(user)
        if not preferences.notification_in_app:
            return None
        daily_limit = preferences.notification_daily_limit
        if daily_limit == 0:
            return None
        today = timezone.localdate()
        if Notification.objects.filter(user=user, created_at__date=today).count() >= daily_limit:
            return None

    if dedupe_key:
        existing = Notification.objects.filter(user=user, dedupe_key=dedupe_key).first()
        if existing:
            return existing

    try:
        with transaction.atomic():
            return Notification.objects.create(
                user=user,
                type=type,
                title=title,
                message=message,
                link=link,
                dedupe_key=dedupe_key,
            )
    except IntegrityError:
        if dedupe_key:
            return Notification.objects.get(user=user, dedupe_key=dedupe_key)
        raise


def notify_users(users, **notification_data):
    notifications = []
    for user in users:
        notification = create_notification(user=user, **notification_data)
        if notification is not None:
            notifications.append(notification)
    return notifications


def ensure_subscription_expiry_notification(user):
    """Create one warning when a paid subscription is within three days of expiry."""
    expires_at = user.subscription_expires_at
    if user.subscription == 'free' or expires_at is None:
        return None
    expiry_date = timezone.localtime(expires_at).date()
    days_remaining = (expiry_date - timezone.localdate()).days
    if not 0 <= days_remaining <= 3:
        return None
    return create_notification(
        user=user,
        type='subscription',
        title='Subscription expires soon',
        message=f'Your {user.subscription} subscription expires in {days_remaining} day(s).',
        link='/settings#subscription',
        dedupe_key=f'subscription-expiry:{expiry_date.isoformat()}',
    )


def notify_new_release(song):
    """Notify every user following the publishing artist, without duplicates."""
    artist = song.artist
    follower_ids = set(artist.followers.values_list('id', flat=True))
    follower_ids.update(artist.user.followers.values_list('id', flat=True))
    users = artist.user.__class__.objects.filter(id__in=follower_ids)
    return notify_users(
        users,
        type='new_release',
        title=f'New release from {artist.stage_name}',
        message=f'{artist.stage_name} released {song.title}.',
        link=f'/songs/{song.id}',
        dedupe_key=f'new-release:song:{song.id}',
    )

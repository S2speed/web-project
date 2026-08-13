from calendar import monthrange
from datetime import date, datetime, time, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Sum
from django.utils import timezone

from apps.music.models import Artist, StreamEvent
from apps.support.services import create_notification

from .models import ArtistMonthlyStatement


def parse_period(value=None):
    """Return the first day of a YYYY-MM value, or of the current month."""
    if not value:
        current = timezone.localdate()
        return current.replace(day=1)
    try:
        parsed = datetime.strptime(value, '%Y-%m').date()
    except (TypeError, ValueError) as exc:
        raise ValueError('Month must use YYYY-MM format.') from exc
    return parsed.replace(day=1)


def period_bounds(period):
    last_day = monthrange(period.year, period.month)[1]
    next_day = date(period.year, period.month, last_day) + timedelta(days=1)
    start = timezone.make_aware(datetime.combine(period, time.min))
    end = timezone.make_aware(datetime.combine(next_day, time.min))
    return start, end


def calculate_reward(unique_listeners, stream_count):
    """Calculate reward on the backend using configurable per-event rates."""
    stream_rate = Decimal(str(getattr(settings, 'ARTIST_REWARD_PER_STREAM', '0.0028')))
    listener_rate = Decimal(str(getattr(settings, 'ARTIST_REWARD_PER_UNIQUE_LISTENER', '0.01')))
    amount = Decimal(stream_count) * stream_rate + Decimal(unique_listeners) * listener_rate
    return amount.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)


def refresh_statement(artist, period):
    """Refresh a pending statement from authoritative stream events."""
    start, end = period_bounds(period)
    aggregate = StreamEvent.objects.filter(
        song__artist=artist,
        played_at__gte=start,
        played_at__lt=end,
    ).aggregate(
        stream_count=Count('id'),
        unique_listeners=Count('user_id', distinct=True),
    )
    defaults = {
        'stream_count': aggregate['stream_count'] or 0,
        'unique_listeners': aggregate['unique_listeners'] or 0,
    }
    defaults['reward_amount'] = calculate_reward(
        defaults['unique_listeners'], defaults['stream_count'],
    )

    statement, created = ArtistMonthlyStatement.objects.get_or_create(
        artist=artist,
        period=period,
        defaults=defaults,
    )
    if not created and statement.status == ArtistMonthlyStatement.STATUS_PENDING:
        for field, value in defaults.items():
            setattr(statement, field, value)
        statement.save(update_fields=[*defaults.keys(), 'updated_at'])
    return statement


def refresh_monthly_statements(period):
    return [
        refresh_statement(artist, period)
        for artist in Artist.objects.filter(is_verified=True).select_related('user').order_by('stage_name')
    ]


@transaction.atomic
def settle_artist_statement(artist, period, admin_user):
    artist = Artist.objects.select_for_update().select_related('user').get(pk=artist.pk)
    statement = refresh_statement(artist, period)
    statement = ArtistMonthlyStatement.objects.select_for_update().get(pk=statement.pk)
    if statement.status == ArtistMonthlyStatement.STATUS_SETTLED:
        return statement, False

    statement.status = ArtistMonthlyStatement.STATUS_SETTLED
    statement.settled_at = timezone.now()
    statement.settled_by = admin_user
    statement.save(update_fields=['status', 'settled_at', 'settled_by', 'updated_at'])
    create_notification(
        user=artist.user,
        type='financial',
        title='Artist payment settled',
        message=f'Your reward for {period:%Y-%m} was settled: {statement.reward_amount}.',
        link='/artist/dashboard',
        dedupe_key=f'artist-settlement:{artist.id}:{period:%Y-%m}',
    )
    return statement, True


def monthly_revenue(period):
    from .models import Transaction

    start, end = period_bounds(period)
    successful = Transaction.objects.filter(
        status='success',
        verified_at__gte=start,
        verified_at__lt=end,
    )
    totals = {
        row['subscription_type']: {
            'revenue': row['revenue'] or Decimal('0'),
            'sales': row['sales'],
        }
        for row in successful.values('subscription_type').annotate(
            revenue=Sum('amount'),
            sales=Count('id'),
        )
    }
    return totals

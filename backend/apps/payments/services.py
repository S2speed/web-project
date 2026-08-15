from calendar import monthrange
from datetime import date, datetime, time, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.music.models import Artist, StreamEvent
from apps.support.services import create_notification

from .gateways import get_payment_gateway
from .models import ArtistMonthlyStatement, SubscriptionPrice, Transaction, UserSubscription


class PaymentConflictError(ValueError):
    pass


class PaymentStateError(ValueError):
    pass


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


def add_months(value, months):
    """Add calendar months while clamping the day to the destination month."""
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, monthrange(year, month)[1])
    return value.replace(year=year, month=month, day=day)


@transaction.atomic
def create_checkout(user, subscription_type, duration_months, idempotency_key=''):
    """Create an amount-snapshotted pending payment and initialize its gateway session."""
    if subscription_type not in ('silver', 'gold'):
        raise ValueError('Only silver and gold subscriptions can be purchased.')
    if duration_months not in dict(Transaction.DURATION_CHOICES):
        raise ValueError('Subscription duration must be 1, 3, 6, or 12 months.')

    normalized_key = (idempotency_key or '').strip()
    if normalized_key:
        existing = Transaction.objects.select_for_update().filter(
            user=user,
            idempotency_key=normalized_key,
        ).first()
        if existing:
            if (
                existing.subscription_type != subscription_type
                or existing.duration_months != duration_months
            ):
                raise PaymentConflictError('This idempotency key was already used for another checkout.')
            return existing, False

    try:
        price = SubscriptionPrice.objects.select_for_update().get(
            subscription_type=subscription_type,
        )
    except SubscriptionPrice.DoesNotExist as exc:
        raise ValueError('The selected subscription price is not configured.') from exc

    amount = price.price * duration_months
    ttl_minutes = int(getattr(settings, 'PAYMENT_PENDING_TTL_MINUTES', 15))
    gateway = get_payment_gateway()
    payment = Transaction.objects.create(
        user=user,
        subscription_type=subscription_type,
        duration_months=duration_months,
        amount=amount,
        currency='IRR',
        payment_gateway=gateway.name,
        idempotency_key=normalized_key,
        expires_at=timezone.now() + timedelta(minutes=ttl_minutes),
    )
    request_result = gateway.request_payment(payment)
    payment.gateway_authority = request_result.authority
    payment.payment_data = {
        'request': request_result.metadata,
        'payment_url': request_result.payment_url,
    }
    payment.save(update_fields=['gateway_authority', 'payment_data', 'updated_at'])
    return payment, True


def _activate_subscription(payment, now):
    try:
        return payment.subscription_period
    except UserSubscription.DoesNotExist:
        pass

    user_model = payment.user.__class__
    user = user_model.objects.select_for_update().get(pk=payment.user_id)
    current_expiry = user.subscription_expires_at
    same_active_plan = (
        user.subscription == payment.subscription_type
        and current_expiry is not None
        and current_expiry > now
    )
    starts_at = current_expiry if same_active_plan else now

    if not same_active_plan:
        UserSubscription.objects.filter(
            user=user,
            status=UserSubscription.STATUS_ACTIVE,
        ).update(status=UserSubscription.STATUS_REPLACED, updated_at=now)

    subscription = UserSubscription.objects.create(
        user=user,
        transaction=payment,
        subscription_type=payment.subscription_type,
        starts_at=starts_at,
        expires_at=add_months(starts_at, payment.duration_months),
    )
    user.subscription = payment.subscription_type
    user.subscription_expires_at = subscription.expires_at
    user.save(update_fields=['subscription', 'subscription_expires_at', 'updated_at'])
    create_notification(
        user=user,
        type='subscription',
        title='Subscription activated',
        message=(
            f'Your {payment.subscription_type} subscription is active until '
            f'{subscription.expires_at.date().isoformat()}.'
        ),
        link='/settings#subscription',
        dedupe_key=f'subscription-payment:{payment.id}',
    )
    return subscription


@transaction.atomic
def complete_payment(authority, gateway_status):
    """Verify a callback once and activate/extend the purchased subscription."""
    payment = Transaction.objects.select_for_update().select_related('user').get(
        gateway_authority=authority,
    )
    if payment.status == 'success':
        return payment, _activate_subscription(payment, payment.verified_at or timezone.now()), False
    if payment.status == 'failed':
        return payment, None, False

    gateway = get_payment_gateway()
    if payment.payment_gateway != gateway.name:
        raise PaymentStateError('The configured gateway does not match this transaction.')

    verification = gateway.verify_payment(payment, gateway_status)
    verification_data = dict(payment.payment_data or {})
    verification_data['verification'] = verification.metadata or {}
    payment.payment_data = verification_data
    if not verification.successful:
        payment.status = 'failed'
        payment.failure_reason = verification.failure_reason
        payment.save(update_fields=['status', 'failure_reason', 'payment_data', 'updated_at'])
        return payment, None, True

    now = timezone.now()
    payment.status = 'success'
    payment.reference_id = verification.reference_id
    payment.failure_reason = ''
    payment.verified_at = now
    payment.save(update_fields=[
        'status', 'reference_id', 'failure_reason', 'verified_at', 'payment_data', 'updated_at',
    ])
    return payment, _activate_subscription(payment, now), True


@transaction.atomic
def refresh_user_subscription(user):
    """Downgrade an expired account and return its most relevant subscription period."""
    user_model = user.__class__
    locked_user = user_model.objects.select_for_update().get(pk=user.pk)
    now = timezone.now()
    UserSubscription.objects.filter(
        user=locked_user,
        status=UserSubscription.STATUS_ACTIVE,
        expires_at__lte=now,
    ).update(status=UserSubscription.STATUS_EXPIRED, updated_at=now)
    if (
        locked_user.subscription != 'free'
        and locked_user.subscription_expires_at is not None
        and locked_user.subscription_expires_at <= now
    ):
        locked_user.subscription = 'free'
        locked_user.subscription_expires_at = None
        locked_user.save(update_fields=['subscription', 'subscription_expires_at', 'updated_at'])
    subscriptions = UserSubscription.objects.filter(user=locked_user)
    current = subscriptions.filter(status=UserSubscription.STATUS_ACTIVE).first()
    return locked_user, current or subscriptions.first()


@transaction.atomic
def set_cancel_at_period_end(user, should_cancel):
    locked_user, subscription = refresh_user_subscription(user)
    if not subscription or subscription.status != UserSubscription.STATUS_ACTIVE:
        raise PaymentStateError('There is no active paid subscription.')
    subscription.cancel_at_period_end = should_cancel
    subscription.cancelled_at = timezone.now() if should_cancel else None
    subscription.save(update_fields=['cancel_at_period_end', 'cancelled_at', 'updated_at'])
    return locked_user, subscription


def payment_report(period):
    """Return frontend-ready payment/subscription aggregates for one month."""
    start, end = period_bounds(period)
    monthly = Transaction.objects.filter(created_at__gte=start, created_at__lt=end)
    successful = Transaction.objects.filter(
        status='success', verified_at__gte=start, verified_at__lt=end,
    )

    status_counts = {'pending': 0, 'success': 0, 'failed': 0}
    for row in monthly.values('status').annotate(count=Count('id')):
        if row['status'] in status_counts:
            status_counts[row['status']] = row['count']

    by_plan = {
        row['subscription_type']: {'sales': row['sales'], 'revenue': str(row['revenue'] or 0)}
        for row in successful.values('subscription_type').annotate(
            sales=Count('id'), revenue=Sum('amount'),
        )
    }
    by_duration = {
        str(row['duration_months']): {'sales': row['sales'], 'revenue': str(row['revenue'] or 0)}
        for row in successful.values('duration_months').annotate(
            sales=Count('id'), revenue=Sum('amount'),
        )
    }
    daily = [
        {'date': row['day'].isoformat(), 'sales': row['sales'], 'revenue': str(row['revenue'] or 0)}
        for row in successful.annotate(day=TruncDate('verified_at')).values('day').annotate(
            sales=Count('id'), revenue=Sum('amount'),
        ).order_by('day')
        if row['day'] is not None
    ]
    totals = successful.aggregate(sales=Count('id'), revenue=Sum('amount'))
    now = timezone.now()
    user_model = Transaction._meta.get_field('user').remote_field.model
    return {
        'month': period.strftime('%Y-%m'),
        'transactions': {'total': monthly.count(), 'by_status': status_counts},
        'revenue': {
            'total': str(totals['revenue'] or Decimal('0')),
            'sales': totals['sales'] or 0,
            'by_plan': by_plan,
            'by_duration_months': by_duration,
            'daily': daily,
        },
        'subscribers': {
            'active': user_model.objects.filter(
                subscription__in=('silver', 'gold'), subscription_expires_at__gt=now,
            ).count(),
            'expiring_within_7_days': user_model.objects.filter(
                subscription__in=('silver', 'gold'),
                subscription_expires_at__gt=now,
                subscription_expires_at__lte=now + timedelta(days=7),
            ).count(),
        },
    }

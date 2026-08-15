from django.db import models
from django.conf import settings
from django.utils import timezone


SUBSCRIPTION_CHOICES = (
    ('free', 'free'),
    ('silver', 'silver'),
    ('gold', 'gold'),
)


class SubscriptionPrice(models.Model):
    """Admin-manageable subscription pricing."""

    subscription_type = models.CharField(max_length=20, choices=SUBSCRIPTION_CHOICES, unique=True)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    duration_days = models.PositiveIntegerField(default=30)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        verbose_name = 'subscription price'
        verbose_name_plural = 'subscription prices'

    def __str__(self):
        return f"{self.get_subscription_type_display()} - {self.price}"


class Transaction(models.Model):
    """Payment transaction record."""

    STATUS_CHOICES = (
        ('pending', 'pending'),
        ('success', 'success'),
        ('failed', 'failed'),
    )
    DURATION_CHOICES = (
        (1, '1 month'),
        (3, '3 months'),
        (6, '6 months'),
        (12, '12 months'),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='transactions')
    subscription_type = models.CharField(max_length=20, choices=SUBSCRIPTION_CHOICES)
    duration_months = models.PositiveSmallIntegerField(choices=DURATION_CHOICES, default=1)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=8, default='IRR')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    reference_id = models.CharField(max_length=100, blank=True)
    payment_gateway = models.CharField(max_length=50, default='sandbox')
    gateway_authority = models.CharField(max_length=100, blank=True)
    idempotency_key = models.CharField(max_length=64, blank=True)
    failure_reason = models.CharField(max_length=250, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    payment_data = models.JSONField(default=dict, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'transaction'
        verbose_name_plural = 'transactions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status', 'created_at'], name='payment_user_status_idx'),
            models.Index(fields=['status', 'verified_at'], name='payment_status_verified_idx'),
        ]
        constraints = [
            models.CheckConstraint(condition=models.Q(amount__gt=0), name='payment_amount_positive'),
            models.UniqueConstraint(
                fields=['user', 'idempotency_key'],
                condition=~models.Q(idempotency_key=''),
                name='unique_user_payment_idempotency',
            ),
            models.UniqueConstraint(
                fields=['gateway_authority'],
                condition=~models.Q(gateway_authority=''),
                name='unique_payment_gateway_authority',
            ),
        ]

    def __str__(self):
        return f"{self.user.display_name} - {self.subscription_type} - {self.status}"

    @property
    def is_expired(self):
        return bool(self.expires_at and self.expires_at <= timezone.now())


class UserSubscription(models.Model):
    """A paid subscription period created by exactly one successful transaction."""

    STATUS_ACTIVE = 'active'
    STATUS_EXPIRED = 'expired'
    STATUS_REPLACED = 'replaced'
    STATUS_CHOICES = (
        (STATUS_ACTIVE, 'active'),
        (STATUS_EXPIRED, 'expired'),
        (STATUS_REPLACED, 'replaced'),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='subscription_periods',
    )
    transaction = models.OneToOneField(
        Transaction,
        on_delete=models.CASCADE,
        related_name='subscription_period',
    )
    subscription_type = models.CharField(
        max_length=20,
        choices=(('silver', 'silver'), ('gold', 'gold')),
    )
    starts_at = models.DateTimeField()
    expires_at = models.DateTimeField()
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    cancel_at_period_end = models.BooleanField(default=False)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-expires_at', '-id']
        indexes = [
            models.Index(fields=['user', 'status', 'expires_at'], name='subscription_user_state_idx'),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(expires_at__gt=models.F('starts_at')),
                name='subscription_expiry_after_start',
            ),
        ]

    def __str__(self):
        return f'{self.user.email} - {self.subscription_type} until {self.expires_at}'


class ArtistMonthlyStatement(models.Model):
    """Immutable-after-settlement monthly accounting snapshot for an artist."""

    STATUS_PENDING = 'pending'
    STATUS_SETTLED = 'settled'
    STATUS_CHOICES = (
        (STATUS_PENDING, 'pending'),
        (STATUS_SETTLED, 'settled'),
    )

    artist = models.ForeignKey(
        'music.Artist',
        on_delete=models.CASCADE,
        related_name='monthly_statements',
    )
    period = models.DateField(help_text='First day of the accounting month.')
    unique_listeners = models.PositiveIntegerField(default=0)
    stream_count = models.PositiveBigIntegerField(default=0)
    reward_amount = models.DecimalField(max_digits=16, decimal_places=4, default=0)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_PENDING)
    settled_at = models.DateTimeField(null=True, blank=True)
    settled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='settled_artist_statements',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-period', 'artist__stage_name']
        constraints = [
            models.UniqueConstraint(
                fields=['artist', 'period'],
                name='unique_artist_monthly_statement',
            ),
        ]

    def __str__(self):
        return f'{self.artist.stage_name} - {self.period:%Y-%m}'

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
    price = models.PositiveIntegerField()
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

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='transactions')
    subscription_type = models.CharField(max_length=20, choices=SUBSCRIPTION_CHOICES)
    amount = models.PositiveIntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    reference_id = models.CharField(max_length=100, blank=True)
    payment_gateway = models.CharField(max_length=50, blank=True)

    payment_data = models.JSONField(default=dict, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'transaction'
        verbose_name_plural = 'transactions'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.display_name} - {self.subscription_type} - {self.status}"

    def verify_payment(self, reference_id):
        """Mark the transaction as successful and update the user's subscription."""
        self.status = 'success'
        self.reference_id = reference_id
        self.verified_at = timezone.now()
        self.save()

        # update user subscription
        user = self.user
        user.subscription = self.subscription_type
        user.save()

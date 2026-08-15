from rest_framework import serializers

from django.conf import settings

from .models import ArtistMonthlyStatement, SubscriptionPrice, Transaction, UserSubscription


class CheckoutSerializer(serializers.Serializer):
    subscription_type = serializers.ChoiceField(choices=('silver', 'gold'))
    duration_months = serializers.ChoiceField(choices=(1, 3, 6, 12))
    idempotency_key = serializers.CharField(max_length=64, required=False, allow_blank=True)


class PaymentCallbackSerializer(serializers.Serializer):
    authority = serializers.CharField(max_length=100)
    status = serializers.ChoiceField(choices=('success', 'failed', 'ok', 'cancelled'))


class TransactionSerializer(serializers.ModelSerializer):
    payment_url = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = (
            'id', 'subscription_type', 'duration_months', 'amount', 'currency',
            'status', 'reference_id', 'payment_gateway', 'gateway_authority',
            'failure_reason', 'payment_url', 'expires_at', 'verified_at',
            'created_at', 'updated_at',
        )
        read_only_fields = fields

    def get_payment_url(self, obj):
        if obj.status != 'pending' or not obj.gateway_authority:
            return None
        base_url = getattr(settings, 'BACKEND_PUBLIC_URL', 'http://localhost:8000').rstrip('/')
        if obj.payment_gateway == 'sandbox':
            return f'{base_url}/api/payments/sandbox/{obj.gateway_authority}/'
        return (obj.payment_data or {}).get('payment_url')


class UserSubscriptionSerializer(serializers.ModelSerializer):
    transaction_id = serializers.IntegerField(source='transaction.id', read_only=True)

    class Meta:
        model = UserSubscription
        fields = (
            'id', 'transaction_id', 'subscription_type', 'starts_at', 'expires_at',
            'status', 'cancel_at_period_end', 'cancelled_at', 'created_at',
        )
        read_only_fields = fields


class SubscriptionPriceSerializer(serializers.ModelSerializer):
    updated_by = serializers.CharField(source='updated_by.display_name', read_only=True)

    class Meta:
        model = SubscriptionPrice
        fields = ('subscription_type', 'price', 'duration_days', 'updated_at', 'updated_by')
        read_only_fields = ('updated_at', 'updated_by')


class SubscriptionPriceUpdateSerializer(serializers.Serializer):
    silver = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)
    gold = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)

    def validate(self, attrs):
        if attrs['silver'] <= 0 or attrs['gold'] <= 0:
            raise serializers.ValidationError('Subscription prices must be greater than zero.')
        return attrs


class ArtistMonthlyStatementSerializer(serializers.ModelSerializer):
    artist_id = serializers.IntegerField(source='artist.id', read_only=True)
    artist_identifier = serializers.CharField(source='artist.user.email', read_only=True)
    artist_name = serializers.CharField(source='artist.stage_name', read_only=True)
    settled_by = serializers.CharField(source='settled_by.display_name', read_only=True)

    class Meta:
        model = ArtistMonthlyStatement
        fields = (
            'id', 'artist_id', 'artist_identifier', 'artist_name', 'period',
            'unique_listeners', 'stream_count', 'reward_amount', 'status',
            'settled_at', 'settled_by', 'created_at', 'updated_at',
        )

from rest_framework import serializers

from .models import ArtistMonthlyStatement, SubscriptionPrice


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

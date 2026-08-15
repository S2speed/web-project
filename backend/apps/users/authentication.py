from django.utils import timezone
from rest_framework_simplejwt.authentication import JWTAuthentication


class SubscriptionAwareJWTAuthentication(JWTAuthentication):
    """Keep an expired paid plan from authorizing another API request."""

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None
        user, validated_token = result
        if (
            user.subscription != 'free'
            and user.subscription_expires_at is not None
            and user.subscription_expires_at <= timezone.now()
        ):
            from apps.payments.services import refresh_user_subscription

            user, _ = refresh_user_subscription(user)
        return user, validated_token

"""Checkout, subscription management, accounting, and report API views."""
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.music.models import Artist
from apps.users.permissions import IsAdmin

from .models import ArtistMonthlyStatement, SubscriptionPrice, Transaction
from .serializers import (
    ArtistMonthlyStatementSerializer,
    CheckoutSerializer,
    PaymentCallbackSerializer,
    SubscriptionPriceSerializer,
    SubscriptionPriceUpdateSerializer,
    TransactionSerializer,
    UserSubscriptionSerializer,
)
from .services import (
    PaymentConflictError,
    PaymentStateError,
    complete_payment,
    create_checkout,
    monthly_revenue,
    parse_period,
    payment_report,
    refresh_monthly_statements,
    refresh_user_subscription,
    set_cancel_at_period_end,
    settle_artist_statement,
)


DEFAULT_PRICES = {'silver': Decimal('7.99'), 'gold': Decimal('12.99')}


def _period_or_error(request):
    try:
        return parse_period(request.query_params.get('month')), None
    except ValueError as exc:
        return None, Response({'month': [str(exc)]}, status=status.HTTP_400_BAD_REQUEST)


class SubscriptionPriceView(APIView):
    """Public price list; only the single system admin may update it."""

    permission_classes = [AllowAny]

    def get(self, request):
        for tier, price in DEFAULT_PRICES.items():
            SubscriptionPrice.objects.get_or_create(
                subscription_type=tier,
                defaults={'price': price, 'duration_days': 30},
            )
        prices = SubscriptionPrice.objects.filter(subscription_type__in=DEFAULT_PRICES).order_by('price')
        return Response({'results': SubscriptionPriceSerializer(prices, many=True).data})

    def put(self, request):
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication credentials were not provided.'}, status=status.HTTP_401_UNAUTHORIZED)
        if not (request.user.is_superuser or request.user.role == 'admin'):
            return Response({'detail': 'Only administrators can change subscription prices.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = SubscriptionPriceUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            for tier, price in serializer.validated_data.items():
                SubscriptionPrice.objects.update_or_create(
                    subscription_type=tier,
                    defaults={'price': price, 'duration_days': 30, 'updated_by': request.user},
                )
        prices = SubscriptionPrice.objects.filter(subscription_type__in=DEFAULT_PRICES).order_by('price')
        return Response({'results': SubscriptionPriceSerializer(prices, many=True).data})


class CheckoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payment, created = create_checkout(request.user, **serializer.validated_data)
        except PaymentConflictError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_409_CONFLICT)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {'created': created, 'transaction': TransactionSerializer(payment).data},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class TransactionHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        payments = Transaction.objects.filter(user=request.user).order_by('-created_at')
        return Response({'results': TransactionSerializer(payments, many=True).data})


def _complete_or_error(authority, gateway_status):
    try:
        payment, subscription, changed = complete_payment(authority, gateway_status)
    except Transaction.DoesNotExist:
        return None, Response({'detail': 'Payment transaction was not found.'}, status=status.HTTP_404_NOT_FOUND)
    except PaymentStateError as exc:
        return None, Response({'detail': str(exc)}, status=status.HTTP_409_CONFLICT)
    payload = {
        'changed': changed,
        'transaction': TransactionSerializer(payment).data,
        'subscription': UserSubscriptionSerializer(subscription).data if subscription else None,
    }
    response_status = status.HTTP_200_OK if payment.status == 'success' else status.HTTP_400_BAD_REQUEST
    return payload, Response(payload, status=response_status)


class PaymentCallbackView(APIView):
    """Provider callback; authority is verified by the configured gateway adapter."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PaymentCallbackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        _, response = _complete_or_error(
            serializer.validated_data['authority'],
            serializer.validated_data['status'],
        )
        return response


class SandboxPaymentView(APIView):
    permission_classes = [AllowAny]

    def _ensure_enabled(self):
        return getattr(settings, 'PAYMENT_GATEWAY', 'sandbox').lower() == 'sandbox'

    def get(self, request, authority):
        if not self._ensure_enabled():
            return Response({'detail': 'Sandbox gateway is disabled.'}, status=status.HTTP_404_NOT_FOUND)
        payment = get_object_or_404(Transaction, gateway_authority=authority)
        return Response({
            'mode': 'sandbox',
            'detail': 'POST status=success or status=failed to this URL.',
            'transaction': TransactionSerializer(payment).data,
        })

    def post(self, request, authority):
        if not self._ensure_enabled():
            return Response({'detail': 'Sandbox gateway is disabled.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = PaymentCallbackSerializer(data={
            'authority': authority,
            'status': request.data.get('status'),
        })
        serializer.is_valid(raise_exception=True)
        _, response = _complete_or_error(authority, serializer.validated_data['status'])
        return response


class CurrentSubscriptionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user, subscription = refresh_user_subscription(request.user)
        return Response({
            'subscription_type': user.subscription,
            'expires_at': user.subscription_expires_at,
            'subscription': UserSubscriptionSerializer(subscription).data if subscription else None,
        })


class CancelSubscriptionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            user, subscription = set_cancel_at_period_end(request.user, True)
        except PaymentStateError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_409_CONFLICT)
        return Response({
            'detail': 'Subscription will remain active until the end of the paid period.',
            'subscription_type': user.subscription,
            'subscription': UserSubscriptionSerializer(subscription).data,
        })


class ResumeSubscriptionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            user, subscription = set_cancel_at_period_end(request.user, False)
        except PaymentStateError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_409_CONFLICT)
        return Response({
            'detail': 'Period-end cancellation was removed.',
            'subscription_type': user.subscription,
            'subscription': UserSubscriptionSerializer(subscription).data,
        })


class ArtistAccountingView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        period, error = _period_or_error(request)
        if error:
            return error
        refresh_monthly_statements(period)
        statements = ArtistMonthlyStatement.objects.filter(period=period).select_related('artist__user', 'settled_by')
        data = ArtistMonthlyStatementSerializer(statements, many=True).data
        return Response({'month': period.strftime('%Y-%m'), 'count': len(data), 'results': data})


class ArtistSettlementView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, artist_id):
        period, error = _period_or_error(request)
        if error:
            return error
        artist = get_object_or_404(Artist.objects.filter(is_verified=True), id=artist_id)
        statement, created = settle_artist_statement(artist, period, request.user)
        response_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(
            {
                'created': created,
                'statement': ArtistMonthlyStatementSerializer(statement).data,
            },
            status=response_status,
        )


class AdminOverviewView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        period, error = _period_or_error(request)
        if error:
            return error

        distribution = {'free': 0, 'silver': 0, 'gold': 0}
        for row in get_user_model().objects.values('subscription').annotate(count=Count('id')):
            if row['subscription'] in distribution:
                distribution[row['subscription']] = row['count']

        by_plan = monthly_revenue(period)
        plan_data = {
            tier: {
                'revenue': str(by_plan.get(tier, {}).get('revenue', Decimal('0.00'))),
                'sales': by_plan.get(tier, {}).get('sales', 0),
            }
            for tier in ('silver', 'gold')
        }
        total_revenue = sum(Decimal(item['revenue']) for item in plan_data.values())
        total_sales = sum(item['sales'] for item in plan_data.values())
        return Response({
            'month': period.strftime('%Y-%m'),
            'subscription_distribution': distribution,
            'subscription_sales': plan_data,
            'total_subscription_revenue': str(total_revenue),
            'total_subscription_sales': total_sales,
        })


class AdminPaymentReportView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        period, error = _period_or_error(request)
        if error:
            return error
        return Response(payment_report(period))

"""Subscription pricing, accounting, and admin report API views."""
from decimal import Decimal

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

from .models import ArtistMonthlyStatement, SubscriptionPrice
from .serializers import (
    ArtistMonthlyStatementSerializer,
    SubscriptionPriceSerializer,
    SubscriptionPriceUpdateSerializer,
)
from .services import monthly_revenue, parse_period, refresh_monthly_statements, settle_artist_statement


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

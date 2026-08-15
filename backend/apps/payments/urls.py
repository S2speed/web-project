"""URLs for payments app."""
from django.urls import path
from . import views

urlpatterns = [
    path('prices/', views.SubscriptionPriceView.as_view(), name='subscription-prices'),
    path('checkout/', views.CheckoutView.as_view(), name='payment-checkout'),
    path('callback/', views.PaymentCallbackView.as_view(), name='payment-callback'),
    path('sandbox/<str:authority>/', views.SandboxPaymentView.as_view(), name='sandbox-payment'),
    path('transactions/', views.TransactionHistoryView.as_view(), name='transaction-history'),
    path('subscriptions/me/', views.CurrentSubscriptionView.as_view(), name='current-subscription'),
    path('subscriptions/cancel/', views.CancelSubscriptionView.as_view(), name='cancel-subscription'),
    path('subscriptions/resume/', views.ResumeSubscriptionView.as_view(), name='resume-subscription'),
    path('accounting/', views.ArtistAccountingView.as_view(), name='artist-accounting'),
    path('accounting/artists/<int:artist_id>/settle/', views.ArtistSettlementView.as_view(), name='artist-settlement'),
    path('admin/overview/', views.AdminOverviewView.as_view(), name='admin-overview'),
    path('admin/reports/', views.AdminPaymentReportView.as_view(), name='admin-payment-report'),
]

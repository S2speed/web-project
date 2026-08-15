"""Replaceable payment-gateway adapter used by the checkout service."""
from dataclasses import dataclass
from typing import Optional
from uuid import uuid4

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


@dataclass(frozen=True)
class PaymentRequestResult:
    authority: str
    payment_url: str
    metadata: dict


@dataclass(frozen=True)
class PaymentVerificationResult:
    successful: bool
    reference_id: str = ''
    failure_reason: str = ''
    metadata: Optional[dict] = None


class SandboxPaymentGateway:
    """Local deterministic gateway for development and automated acceptance tests."""

    name = 'sandbox'

    def request_payment(self, payment):
        authority = uuid4().hex
        base_url = getattr(settings, 'BACKEND_PUBLIC_URL', 'http://localhost:8000').rstrip('/')
        return PaymentRequestResult(
            authority=authority,
            payment_url=f'{base_url}/api/payments/sandbox/{authority}/',
            metadata={'mode': 'sandbox'},
        )

    def verify_payment(self, payment, gateway_status):
        normalized = str(gateway_status or '').strip().lower()
        if payment.is_expired:
            return PaymentVerificationResult(False, failure_reason='Payment session expired.')
        if normalized not in {'ok', 'success', 'successful'}:
            return PaymentVerificationResult(False, failure_reason='Payment was cancelled or failed.')
        return PaymentVerificationResult(
            True,
            reference_id=f'SBX-{uuid4().hex[:20].upper()}',
            metadata={'verified_by': 'sandbox'},
        )


def get_payment_gateway():
    gateway_name = getattr(settings, 'PAYMENT_GATEWAY', 'sandbox').strip().lower()
    if gateway_name == SandboxPaymentGateway.name:
        return SandboxPaymentGateway()
    raise ImproperlyConfigured(
        f'Unsupported PAYMENT_GATEWAY={gateway_name!r}. Configure a supported gateway adapter.'
    )

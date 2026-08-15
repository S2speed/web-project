# Phase 6: Payments, subscriptions, and reports

Phase 6 implements the three requested backend capabilities: a replaceable
payment gateway, subscription lifecycle management, and backend-aggregated
financial reports. The default gateway is a local sandbox so the full purchase
flow can be tested without credentials or external network access.

JWT-protected endpoints use `Authorization: Bearer <access-token>`.

## Payment flow

- `POST /api/payments/checkout/` — authenticated user
- `POST /api/payments/callback/` — gateway callback
- `GET|POST /api/payments/sandbox/{authority}/` — local sandbox page/action
- `GET /api/payments/transactions/` — current user's transaction history

Create a checkout:

```json
{
  "subscription_type": "gold",
  "duration_months": 3,
  "idempotency_key": "settings-gold-3m-001"
}
```

Only `silver` and `gold` can be purchased. Supported periods are 1, 3, 6, and
12 calendar months. The transaction stores the current monthly price multiplied
by the selected period, so later price changes do not alter an existing order.
`idempotency_key` is optional but strongly recommended: repeating the same
request returns the original order, while reusing a key for different purchase
parameters returns `409 Conflict`.

A transaction starts as `pending` and has a 15-minute default expiry. Its
response contains `payment_url`. In sandbox mode, post one of these payloads to
that URL:

```json
{"status": "success"}
```

```json
{"status": "failed"}
```

The generic callback accepts:

```json
{"authority": "gateway-authority", "status": "success"}
```

The server verifies the result through the configured adapter before changing
the transaction. A successful callback stores a reference, verification time,
and activates the subscription atomically. Failed, expired, or cancelled
payments never change the user's plan. Repeated callbacks are safe and do not
create another subscription or notification.

Do not return or expose `payment_data`; it is internal gateway audit data.

## Subscription lifecycle

- `GET /api/payments/subscriptions/me/`
- `POST /api/payments/subscriptions/cancel/`
- `POST /api/payments/subscriptions/resume/`

Every successful payment creates an auditable `UserSubscription` period linked
one-to-one to its transaction. Buying the same active plan extends it from its
current expiry; buying another plan starts it immediately and marks the previous
period as replaced. Calendar arithmetic is used, including end-of-month
clamping.

`subscriptions/me` synchronizes expired accounts before responding. An expired
paid account becomes `free`, and its finished periods become `expired`.
The JWT authentication layer applies the same synchronization before protected
API requests, and entitlement checks treat an already-expired tier as `free`.

Cancellation is period-end cancellation: access remains available until the
paid expiry. `resume` removes that flag. These fixed-term sandbox purchases do
not automatically charge a card; a future recurring provider can use the same
flag to suppress renewal.

## Admin reports

- `GET /api/payments/admin/reports/?month=2026-08` — admin only

`month` is optional and defaults to the current month. It must use `YYYY-MM`.
The response is display-ready and aggregated entirely in the backend:

- total transaction count and counts by `pending`, `success`, and `failed`;
- successful sales and revenue totals;
- sales/revenue grouped by plan and purchased duration;
- daily sales/revenue series;
- current active subscribers and subscriptions expiring within seven days.

Only successful transactions contribute to revenue. Existing Phase 4 pricing,
artist accounting, settlement, and overview endpoints remain unchanged.

## Configuration

```dotenv
PAYMENT_GATEWAY=sandbox
PAYMENT_PENDING_TTL_MINUTES=15
BACKEND_PUBLIC_URL=http://localhost:8000
```

`apps/payments/gateways.py` is the adapter boundary for integrating a production
provider. Such an adapter must create a gateway authority/payment URL and verify
the provider callback server-side. Secret keys belong in environment variables,
not source control.

## Apply and verify

```powershell
cd backend
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py test apps.payments.tests.test_phase4_accounting apps.payments.tests.test_phase6_payments
```

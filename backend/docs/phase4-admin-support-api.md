# Phase 4: Admin and support API

Phase 4 implements the four dashboard capabilities required by the project
brief: artist verification, support tickets, monthly artist accounting, and
dynamic subscription pricing/reporting. All report aggregation is performed by
the backend; clients receive display-ready totals rather than raw datasets.

## Access matrix

| Capability | Listener/artist | Support | Admin |
| --- | --- | --- | --- |
| Create/read own ticket | Yes | Yes | Yes |
| Read/search all tickets and reply | No | Yes | Yes |
| Approve/reject artist applications | No | Yes | Yes |
| Read artist accounting | No | No | Yes |
| Settle artist payment | No | No | Yes |
| Read prices | Yes, authentication not required | Yes | Yes |
| Change prices and read revenue reports | No | No | Yes |

JWT authentication uses the existing `Authorization: Bearer <token>` header.

## Artist verification

- `GET /api/music/artists/pending/`
- `POST /api/music/artists/{artist_id}/verify/`

Decision payloads:

```json
{"status": "approved"}
```

```json
{"status": "rejected", "reason": "The portfolio is incomplete."}
```

The rejection reason is mandatory. A decision is atomic, synchronizes both the
artist and user records, records the reviewer and decision state, and creates a
verification notification. A reviewed application cannot be decided again and
returns `409 Conflict`.

## Support tickets

- `GET /api/support/tickets/?status=open&search=billing`
- `POST /api/support/tickets/`
- `GET /api/support/tickets/{ticket_id}/`
- `POST /api/support/tickets/{ticket_id}/replies/`
- `POST /api/support/tickets/{ticket_id}/close/`

Create payload:

```json
{"subject": "Billing question", "message": "Please check my payment."}
```

Reply payload:

```json
{"message": "Your payment was verified."}
```

Ordinary users only see their own tickets. Staff see all tickets and may filter
by status or search subject, body, display name, and email. A staff reply assigns
the ticket, changes it to `answered`, and notifies its owner. An owner follow-up
returns the ticket to `open`. Closed tickets reject new replies with `409`.

## Monthly artist accounting

- `GET /api/payments/accounting/?month=2026-08`
- `POST /api/payments/accounting/artists/{artist_id}/settle/?month=2026-08`

`month` is optional and defaults to the current month. It must use `YYYY-MM`.
Each row contains the artist name and email identifier, unique listeners, stream
count, calculated reward, payment status, and settlement metadata.

The backend reward formula is:

```text
reward = streams * ARTIST_REWARD_PER_STREAM
       + unique_listeners * ARTIST_REWARD_PER_UNIQUE_LISTENER
```

Default rates are `0.0028` and `0.01`; both are deployment settings and can be
changed through environment variables. Pending rows refresh from immutable
`StreamEvent` records. Settlement creates a locked monthly snapshot, records the
admin and timestamp, and notifies the artist. Repeating the same settlement is
safe and does not send a duplicate notification.

## Prices and admin overview

- `GET /api/payments/prices/`
- `PUT /api/payments/prices/` (admin only)
- `GET /api/payments/admin/overview/?month=2026-08` (admin only)

Update both paid tiers atomically:

```json
{"silver": "8.50", "gold": "14.50"}
```

Prices are decimal database values and the updater is audited. The overview
returns subscription distribution for `free`, `silver`, and `gold`, plus sales
count and verified transaction revenue for each paid plan and the requested
month. Failed, pending, and unverified transactions are excluded.

## Apply and verify

```powershell
cd backend
python manage.py migrate
python manage.py test apps.music.tests.test_phase4_verification apps.support.tests.test_phase4_tickets apps.payments.tests.test_phase4_accounting
```

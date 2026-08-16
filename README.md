# Music Streaming Project

The repository contains:

- `music-app/`: the Next.js frontend from Phase 1.
- `backend/`: the Django REST Framework backend for Phase 2.

## Run the full project with Docker

From the repository root, build and start both applications:

```bash
docker compose up --build
```

The frontend is available at <http://localhost:3000> and the backend API at
<http://localhost:8000/api/>. Database records and uploaded media are stored in
the `backend_data` Docker volume and survive container restarts.

To load the project's sample data after the containers are running:

```bash
docker compose exec backend python manage.py seed_data
```

Stop the applications with `Ctrl+C`, then run `docker compose down`. To also
remove the persisted database and media, run `docker compose down --volumes`.

The optional `FRONTEND_PORT`, `BACKEND_PORT`, `NEXT_PUBLIC_API_URL`,
`BACKEND_PUBLIC_URL`, `SECRET_KEY`, and `DEBUG` variables can be set in a root
`.env` file. When changing the public backend port, update both
`NEXT_PUBLIC_API_URL` and `BACKEND_PUBLIC_URL` to match it.

## Phase 3: playlists and playback

Phase 3 implements subscription-aware playlists, a synchronized playback queue,
and authoritative stream accounting. API details and acceptance criteria are in
[`backend/docs/phase3-api.md`](backend/docs/phase3-api.md).

## Phase 4: admin and support

Phase 4 completes role-aware artist verification, private support-ticket
conversations, backend-aggregated monthly artist accounting and settlement, and
admin-controlled subscription prices/revenue reports. API contracts, access
rules, accounting behavior, and examples are documented in
[`backend/docs/phase4-admin-support-api.md`](backend/docs/phase4-admin-support-api.md).

## Phase 5: notifications and settings

Phase 5 adds synchronized user preferences, secure account deletion, a private
notification inbox, read/delete actions, daily notification limits, duplicate
protection, and automatic role-aware events. See
[`backend/docs/phase5-notifications-settings-api.md`](backend/docs/phase5-notifications-settings-api.md).

## Phase 6: payments and subscriptions

Phase 6 adds idempotent checkout and callback verification through a replaceable
gateway adapter, 1/3/6/12-month subscription lifecycle management, transaction
history, and backend-aggregated admin payment reports. See
[`backend/docs/phase6-payments-subscriptions-api.md`](backend/docs/phase6-payments-subscriptions-api.md).

### Backend development

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py test apps.music.tests.test_phase3
python manage.py test apps.music.tests.test_phase4_verification apps.support.tests.test_phase4_tickets apps.payments.tests.test_phase4_accounting
python manage.py test apps.users.tests.test_phase5_settings apps.support.tests.test_phase5_notifications apps.music.tests.test_phase5_role_notifications
python manage.py test apps.payments.tests.test_phase6_payments
python manage.py runserver
```

### Frontend development

```powershell
cd music-app
npm install
npm test -- --runInBand
npm run dev
```

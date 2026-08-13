# Music Streaming Project

The repository contains:

- `music-app/`: the Next.js frontend from Phase 1.
- `backend/`: the Django REST Framework backend for Phase 2.

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
python manage.py runserver
```

### Frontend development

```powershell
cd music-app
npm install
npm test -- --runInBand
npm run dev
```

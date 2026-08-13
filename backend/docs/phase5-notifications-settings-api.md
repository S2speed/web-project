# Phase 5: Notifications and user settings API

Phase 5 persists application preferences on the backend and provides a private,
role-aware notification inbox. The existing Phase 1 pages can consume these
contracts during the frontend integration phase.

## User settings

- `GET /api/users/settings/`
- `PATCH /api/users/settings/`
- `DELETE /api/users/settings/account/`

Settings are stored in a one-to-one `UserSettings` record, so they follow the
account across browsers and devices. A typical response is:

```json
{
  "notification_settings": {
    "in_app": true,
    "push": true,
    "email": true,
    "daily_limit": 10
  },
  "app_sound": true,
  "language": "fa",
  "subscription": {
    "type": "silver",
    "expires_at": "2026-08-31T20:30:00Z",
    "manage_url": "/settings#subscription"
  },
  "updated_at": "2026-08-13T10:00:00Z"
}
```

`PATCH` accepts any subset. `daily_limit` is an integer from 0 through 50 and
languages are `fa` and `en`. A limit of zero, or `in_app: false`, prevents new
in-app records. Email and push choices are persisted for the corresponding
delivery adapters.

Account deletion is deliberately protected and requires both the current
password and the exact Persian confirmation phrase:

```json
{
  "password": "current-password",
  "confirmation": "حذف حساب"
}
```

Successful deletion returns `204` and Django cascades account-owned database
records. Existing JWTs stop authenticating because their user no longer exists.

## Notification inbox

- `GET /api/support/notifications/`
- `PATCH /api/support/notifications/{notification_id}/read/`
- `POST /api/support/notifications/read-all/`
- `DELETE /api/support/notifications/{notification_id}/`

The list is private to the authenticated user and paginated. It includes an
`unread_count`, plus `count`, `next`, `previous`, and `results`. Optional filters:

- `state=read` or `state=unread`
- `type=subscription|new_release|verification|financial|ticket`
- `page_size=1..100`

Read and delete operations are ownership-scoped and return `404` for another
user's notification. Marking one or all items as read is idempotent and records
`read_at`.

## Automatic role-aware notifications

All producers use the same preference-aware, daily-bounded and deduplicated
service:

- listeners receive paid-subscription expiry warnings within three days and
  new song notifications from followed artists;
- artists receive verification decisions, including the rejection reason, and
  monthly settlement notifications;
- support and admin users receive new-ticket and new-artist-application alerts;
- ticket owners receive staff reply notifications.

Relative application routes are valid notification links. Event keys make
repeated requests safe; for example, repeatedly opening the inbox creates at
most one warning for the same subscription expiry date.

## Apply and test

```powershell
cd backend
python manage.py migrate
python manage.py test apps.users.tests.test_phase5_settings apps.support.tests.test_phase5_notifications apps.music.tests.test_phase5_role_notifications
```

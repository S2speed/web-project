# Music Streaming Project

The repository contains:

- `music-app/`: the Next.js frontend from Phase 1.
- `backend/`: the Django REST Framework backend for Phase 2.

## Phase 3: playlists and playback

Phase 3 implements subscription-aware playlists, a synchronized playback queue,
and authoritative stream accounting. API details and acceptance criteria are in
[`backend/docs/phase3-api.md`](backend/docs/phase3-api.md).

### Backend development

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py test apps.music.tests.test_phase3
python manage.py runserver
```

### Frontend development

```powershell
cd music-app
npm install
npm test -- --runInBand
npm run dev
```

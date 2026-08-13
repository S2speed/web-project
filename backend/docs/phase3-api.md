# Phase 3 - Playlists, playback queue, and stream statistics

This phase covers the three tasks defined in the project breakdown:

1. Playlist management with subscription limits.
2. Playback queue and player state.
3. Stream events, daily limits, and aggregated statistics.

All endpoints below require a JWT access token unless noted otherwise. The API
base path is `/api/music/`.

## Playlists

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `playlists/` | List the authenticated user's playlists. |
| POST | `playlists/create/` | Create a playlist while enforcing the subscription limit. |
| GET | `playlists/{id}/` | Read an owned or public playlist. |
| PATCH/PUT | `playlists/{id}/update/` | Rename or edit an owned playlist. |
| DELETE | `playlists/{id}/delete/` | Delete an owned playlist. |
| POST | `playlists/{id}/add-song/` | Append a song to an owned playlist. |
| DELETE | `playlists/{id}/remove-song/{song_id}/` | Remove a song and compact positions. |
| PUT | `playlists/{id}/reorder/` | Replace the playlist order using all `song_ids`. |
| GET | `playlists/check-limit/` | Return the current count, limit, and remaining slots. |

Limits are 6 playlists for free users, 100 for silver users, and unlimited for
gold users. A song can occur only once in a playlist. `song_ids` and the detailed
`songs` response are always returned in their persisted order.

## Playback queue

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `queue/` | Read or initialize the user's private queue. |
| PUT | `queue/` | Replace queue songs and update current index, repeat, and shuffle. |
| DELETE | `queue/` | Clear the queue. |
| POST | `queue/items/` | Append one song. |
| DELETE | `queue/items/{item_id}/` | Remove one owned queue item. |
| PUT | `queue/reorder/` | Reorder every item and optionally set `current_index`. |

Queue items have their own IDs, so the same song can intentionally appear more
than once. Positions are compacted after deletion. No user can inspect or mutate
another user's queue.

The Phase 1 player also persists queue and playback preferences in browser
storage. It provides play/pause, previous/next, seek, volume, repeat-one,
repeat-all, shuffle, queue reorder/removal, cover art, lyrics, artist/album links,
and gold-only song counters.

## Stream accounting

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `songs/{id}/play/` | Record one stream event. |
| GET | `streams/me/` | Return the user's daily usage and remaining allowance. |
| GET | `songs/{id}/stats/` | Return song totals and a 30-day series. |

`songs/{id}/play/` accepts:

```json
{
  "source": "queue",
  "idempotency_key": "client-generated-session-key"
}
```

The idempotency key prevents a retried request from incrementing statistics
twice. Every valid event increments the stream count, but the listener count is
incremented only the first time that user listens to the song. Artist totals are
updated in the same database transaction. Free accounts are limited to 60
streams per calendar day; silver and gold accounts are unlimited.

Song statistics are available to gold listeners, the owning artist, support,
and administrators. All aggregation is performed by the backend.

## Verification

`apps/music/tests/test_phase3.py` contains 21 API tests covering playlist limits,
ownership and ordering, private queues, queue mutation, idempotency, unique
listeners, subscription stream limits, and statistics authorization.

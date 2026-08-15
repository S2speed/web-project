import { getAllSongs, login, uploadSong } from '@/lib/api';

function response(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => data,
    text: async () => '',
  };
}

describe('frontend Django API adapter', () => {
  beforeEach(() => {
    window.localStorage.clear();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('logs in, stores JWT credentials and maps user settings', async () => {
    fetch
      .mockResolvedValueOnce(response({
        access: 'access-token',
        refresh: 'refresh-token',
        user: {
          id: 4,
          email: 'listener@example.com',
          display_name: 'Listener',
          role: 'listener',
          subscription: 'silver',
        },
      }))
      .mockResolvedValueOnce(response({
        notification_settings: { in_app: true, push: false, email: true, daily_limit: 8 },
        app_sound: true,
        language: 'fa',
        subscription: { type: 'silver', expires_at: null },
      }));

    const result = await login(' Listener@Example.com ', 'secret');

    expect(result).toMatchObject({
      success: true,
      data: {
        user: {
          id: 4,
          displayName: 'Listener',
          subscription: 'silver',
          notificationSettings: { dailyLimit: 8 },
        },
      },
    });
    expect(window.localStorage.getItem('musicApp_accessToken')).toBe('access-token');
  });

  test('maps Django song fields into the existing player shape', async () => {
    fetch.mockResolvedValueOnce(response({
      results: [{
        id: 9,
        title: 'Backend Song',
        artist: 3,
        artist_name: 'Artist',
        album: null,
        cover: '/media/covers/song.jpg',
        audio_file: '/media/songs/song.mp3',
        audio_file_low: '/media/songs/low/song.mp3',
        audio_sources: {
          low: 'http://localhost:8000/media/songs/low/song.mp3',
          high: 'http://localhost:8000/media/songs/song.mp3',
        },
        available_qualities: ['low', 'high'],
        default_quality: 'high',
        duration: 180,
        release_date: '2026-08-15',
        is_single: true,
        play_count: 12,
        listener_count: 7,
      }],
    }));

    const result = await getAllSongs();

    expect(result.data[0]).toMatchObject({
      id: 9,
      artistId: 3,
      albumId: null,
      src: 'http://localhost:8000/media/songs/song.mp3',
      audioSources: {
        low: 'http://localhost:8000/media/songs/low/song.mp3',
        high: 'http://localhost:8000/media/songs/song.mp3',
      },
      availableQualities: ['low', 'high'],
      defaultQuality: 'high',
      playCount: 12,
      listeners: 7,
    });
  });

  test('surfaces backend connection failures to pages', async () => {
    fetch.mockRejectedValueOnce(new Error('network down'));
    const result = await getAllSongs();
    expect(result).toMatchObject({ success: false, error: { status: 0 } });
  });

  test('uploads separate low and high quality audio files', async () => {
    fetch.mockResolvedValueOnce(response({
      id: 10,
      title: 'Uploaded Song',
      artist: 3,
      artist_name: 'Artist',
      audio_file: '/media/songs/high.mp3',
      audio_file_low: '/media/songs/low/low.mp3',
      audio_sources: {
        low: 'http://localhost:8000/media/songs/low/low.mp3',
        high: 'http://localhost:8000/media/songs/high.mp3',
      },
      available_qualities: ['low', 'high'],
      default_quality: 'high',
      duration: 180,
      release_date: '2026-08-15',
      is_single: true,
    }, 201));
    const high = new File(['high'], 'high.mp3', { type: 'audio/mpeg' });
    const low = new File(['low'], 'low.mp3', { type: 'audio/mpeg' });

    const result = await uploadSong({
      title: 'Uploaded Song',
      releaseDate: '2026-08-15',
      featuredArtists: [],
    }, high, low, null);

    expect(result.success).toBe(true);
    const requestBody = fetch.mock.calls[0][1].body;
    expect(requestBody.get('audio_file')).toBe(high);
    expect(requestBody.get('audio_file_low')).toBe(low);
  });
});

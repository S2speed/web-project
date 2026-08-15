import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  apiRequest,
  clearAuthTokens,
  resolveBackendAsset,
  storeAuthTokens,
} from '@/lib/apiClient';

function response(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => data,
    text: async () => '',
  };
}

describe('Django API client', () => {
  beforeEach(() => {
    window.localStorage.clear();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('stores and clears JWT tokens', () => {
    storeAuthTokens({ access: 'access', refresh: 'refresh' });
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBe('access');
    expect(window.localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh');
    clearAuthTokens();
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
  });

  test('adds the access token and serializes JSON requests', async () => {
    storeAuthTokens({ access: 'access' });
    fetch.mockResolvedValueOnce(response({ id: 1 }));

    const result = await apiRequest('/users/me/', { method: 'POST', body: { value: true } });

    expect(result).toEqual({ success: true, data: { id: 1 } });
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer access', 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: true }),
    });
  });

  test('refreshes an expired access token and retries once', async () => {
    storeAuthTokens({ access: 'expired', refresh: 'refresh' });
    fetch
      .mockResolvedValueOnce(response({ detail: 'expired' }, 401))
      .mockResolvedValueOnce(response({ access: 'renewed' }))
      .mockResolvedValueOnce(response({ id: 2 }));

    const result = await apiRequest('/users/me/');

    expect(result).toEqual({ success: true, data: { id: 2 } });
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBe('renewed');
    expect(fetch.mock.calls[2][1].headers.Authorization).toBe('Bearer renewed');
  });

  test('normalizes backend validation errors', async () => {
    fetch.mockResolvedValueOnce(response({ email: ['This email is already registered'] }, 400));
    const result = await apiRequest('/users/register/', { method: 'POST', auth: false, body: {} });
    expect(result).toMatchObject({
      success: false,
      error: { status: 400, message: 'This email is already registered' },
    });
  });

  test('resolves relative media URLs against the backend', () => {
    expect(resolveBackendAsset('/media/covers/song.jpg')).toBe('http://localhost:8000/media/covers/song.jpg');
  });
});

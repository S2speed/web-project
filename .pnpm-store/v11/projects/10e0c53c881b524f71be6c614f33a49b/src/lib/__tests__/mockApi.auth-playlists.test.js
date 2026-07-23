import {
  canCreatePlaylist,
  createPlaylist,
  deletePlaylist,
  login,
  registerUser,
  renamePlaylist,
} from '@/lib/mockApi';
import { STORAGE_KEYS, SUBSCRIPTION_TYPES, USER_ROLES } from '@/utils/constants';

async function settle(promise) {
  await jest.runAllTimersAsync();
  return promise;
}

describe('authentication', () => {
  test('logs in with a case-insensitive email and stores a password-free session', async () => {
    const result = await settle(login(' ADMIN@MUSICAPP.COM ', 'admin123'));

    expect(result.success).toBe(true);
    expect(result.data.user).toMatchObject({
      id: 'user_1',
      email: 'admin@musicapp.com',
      role: USER_ROLES.ADMIN,
    });
    expect(result.data.user).not.toHaveProperty('password');

    const storedUser = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.CURRENT_USER));
    expect(storedUser).toEqual(result.data.user);
  });

  test('rejects invalid login credentials without creating a session', async () => {
    const result = await settle(login('admin@musicapp.com', 'incorrect-password'));

    expect(result).toMatchObject({
      success: false,
      error: { code: 401 },
    });
    expect(window.localStorage.getItem(STORAGE_KEYS.CURRENT_USER)).toBeNull();
  });

  test('registers a listener with normalized input and safe defaults', async () => {
    const result = await settle(
      registerUser({
        email: ' NEW.LISTENER@Example.com ',
        password: 'secure-pass',
        displayName: '  New Listener  ',
      }),
    );

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      email: 'new.listener@example.com',
      displayName: 'New Listener',
      role: USER_ROLES.LISTENER,
      subscription: SUBSCRIPTION_TYPES.FREE,
    });
    expect(result.data).not.toHaveProperty('password');

    const users = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.USERS));
    expect(users.find((user) => user.id === result.data.id)).toHaveProperty('password', 'secure-pass');
  });

  test('prevents registration with an email that already exists', async () => {
    const result = await settle(
      registerUser({
        email: 'ADMIN@musicapp.com',
        password: 'another-password',
      }),
    );

    expect(result).toMatchObject({
      success: false,
      error: { code: 409 },
    });
  });
});

describe('playlists', () => {
  test('creates, renames, and deletes a playlist while keeping the user record in sync', async () => {
    const created = await settle(createPlaylist('user_4', '  Road Trip  '));

    expect(created.success).toBe(true);
    expect(created.data).toMatchObject({ name: 'Road Trip', userId: 'user_4', songIds: [] });

    let users = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.USERS));
    expect(users.find((user) => user.id === 'user_4').playlists).toContain(created.data.id);

    const renamed = await settle(renamePlaylist(created.data.id, 'Night Drive'));
    expect(renamed).toMatchObject({ success: true, data: { name: 'Night Drive' } });

    const deleted = await settle(deletePlaylist(created.data.id));
    expect(deleted.success).toBe(true);

    const playlists = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.PLAYLISTS));
    users = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.USERS));
    expect(playlists.some((playlist) => playlist.id === created.data.id)).toBe(false);
    expect(users.find((user) => user.id === 'user_4').playlists).not.toContain(created.data.id);
  });

  test('enforces the six-playlist limit for a free subscription', async () => {
    await settle(canCreatePlaylist('user_4'));

    const playlists = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.PLAYLISTS));
    const existingCount = playlists.filter((playlist) => playlist.userId === 'user_4').length;

    for (let index = existingCount; index < 6; index += 1) {
      playlists.push({
        id: `free_limit_${index}`,
        name: `Playlist ${index + 1}`,
        userId: 'user_4',
        songIds: [],
      });
    }
    window.localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));

    const limitResult = await settle(canCreatePlaylist('user_4'));
    const createResult = await settle(createPlaylist('user_4', 'One Too Many'));

    expect(limitResult).toMatchObject({
      success: true,
      data: {
        allowed: false,
        limit: 6,
        currentCount: 6,
        remaining: 0,
        subscription: SUBSCRIPTION_TYPES.FREE,
      },
    });
    expect(createResult).toMatchObject({ success: false, error: { code: 403 } });
  });
});

import { PLAYER_INITIAL_STATE, playerReducer } from '@/contexts/PlayerContext';
import { PLAYER_REPEAT_MODES } from '@/utils/constants';

const songs = [
  { id: 'song-a', title: 'First' },
  { id: 'song-b', title: 'Second' },
];

describe('player reducer', () => {
  test('starts the selected song and preserves its queue index', () => {
    const state = playerReducer(PLAYER_INITIAL_STATE, {
      type: 'PLAY_SONG',
      payload: songs[1],
      index: 1,
    });

    expect(state).toMatchObject({ currentSong: songs[1], currentIndex: 1, isPlaying: true });
  });

  test('navigates the queue and wraps at the end when repeat-all is enabled', () => {
    let state = playerReducer(PLAYER_INITIAL_STATE, { type: 'SET_QUEUE', payload: songs });
    state = { ...state, currentSong: songs[0] };
    state = playerReducer(state, { type: 'NEXT' });

    expect(state).toMatchObject({ currentSong: songs[1], currentIndex: 1 });

    state = playerReducer({ ...state, repeatMode: PLAYER_REPEAT_MODES.ALL }, { type: 'NEXT' });
    expect(state).toMatchObject({ currentSong: songs[0], currentIndex: 0, isPlaying: true });

    state = playerReducer(state, { type: 'PREVIOUS' });
    expect(state).toMatchObject({ currentSong: songs[0], currentIndex: 0 });
  });

  test('cycles repeat modes and toggles shuffle', () => {
    let state = playerReducer(PLAYER_INITIAL_STATE, { type: 'TOGGLE_REPEAT' });
    expect(state.repeatMode).toBe(PLAYER_REPEAT_MODES.ALL);

    state = playerReducer(state, { type: 'TOGGLE_REPEAT' });
    expect(state.repeatMode).toBe(PLAYER_REPEAT_MODES.ONE);

    state = playerReducer(state, { type: 'TOGGLE_REPEAT' });
    expect(state.repeatMode).toBe(PLAYER_REPEAT_MODES.NONE);

    state = playerReducer(state, { type: 'TOGGLE_SHUFFLE' });
    expect(state.isShuffle).toBe(true);
  });

  test('toggles the five-second crossfade setting', () => {
    let state = playerReducer(PLAYER_INITIAL_STATE, { type: 'TOGGLE_CROSSFADE' });
    expect(state.isCrossfadeEnabled).toBe(true);

    state = playerReducer(state, { type: 'TOGGLE_CROSSFADE' });
    expect(state.isCrossfadeEnabled).toBe(false);
  });

  test('advances to the preselected queue item used by crossfade', () => {
    const thirdSong = { id: 'song-c', title: 'Third' };
    const state = playerReducer({
      ...PLAYER_INITIAL_STATE,
      queue: [...songs, thirdSong],
      currentSong: songs[0],
      currentIndex: 0,
    }, { type: 'NEXT', index: 2 });

    expect(state).toMatchObject({ currentSong: thirdSong, currentIndex: 2, isPlaying: true });
  });

  test('moves and removes upcoming queue items without losing the current song', () => {
    const thirdSong = { id: 'song-c', title: 'Third' };
    let state = {
      ...PLAYER_INITIAL_STATE,
      queue: [...songs, thirdSong],
      currentSong: songs[0],
      currentIndex: 0,
    };
    state = playerReducer(state, { type: 'MOVE_QUEUE_ITEM', fromIndex: 2, toIndex: 1 });
    expect(state.queue.map((song) => song.id)).toEqual(['song-a', 'song-c', 'song-b']);
    state = playerReducer(state, { type: 'REMOVE_QUEUE_ITEM', index: 1 });
    expect(state.queue.map((song) => song.id)).toEqual(['song-a', 'song-b']);
    expect(state.currentSong).toBe(songs[0]);
  });

  test('clears only upcoming items and keeps playback history in the queue', () => {
    const thirdSong = { id: 'song-c', title: 'Third' };
    const state = playerReducer({
      ...PLAYER_INITIAL_STATE,
      queue: [...songs, thirdSong],
      currentSong: songs[1],
      currentIndex: 1,
    }, { type: 'CLEAR_UPCOMING' });
    expect(state.queue.map((song) => song.id)).toEqual(['song-a', 'song-b']);
    expect(state.currentIndex).toBe(1);
  });

  test('registers a new stream when playback advances', () => {
    let state = playerReducer(PLAYER_INITIAL_STATE, {
      type: 'PLAY_SONG', payload: songs[0], queue: songs, index: 0,
    });
    expect(state.streamNonce).toBe(1);
    state = playerReducer(state, { type: 'NEXT' });
    expect(state.streamNonce).toBe(2);
    expect(state.currentSong).toBe(songs[1]);
  });
});

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
});

'use client';

import { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react';
import { getPlaybackQueue, incrementPlayCount, updatePlaybackQueue } from '@/lib/api';
import { useUser } from '@/contexts/UserContext';
import { PLAYER_REPEAT_MODES, PLAYER_REPEAT_SEQUENCE, STORAGE_KEYS } from '@/utils/constants';

export const PLAYER_INITIAL_STATE = {
  currentSong: null,
  isPlaying: false,
  queue: [],
  currentIndex: 0,
  volume: 0.7,
  repeatMode: PLAYER_REPEAT_MODES.NONE,
  isShuffle: false,
  progress: 0,
  duration: 0,
  error: '',
  streamNonce: 0,
};

function initializePlayerState(initialState) {
  if (typeof window === 'undefined') return initialState;
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.PLAYER_STATE) || 'null');
    if (!saved || !Array.isArray(saved.queue)) return initialState;
    const currentIndex = Math.min(
      Math.max(Number(saved.currentIndex) || 0, 0),
      Math.max(saved.queue.length - 1, 0),
    );
    return {
      ...initialState,
      queue: saved.queue,
      currentIndex,
      currentSong: saved.queue[currentIndex] || null,
      volume: Number.isFinite(Number(saved.volume))
        ? Math.min(Math.max(Number(saved.volume), 0), 1)
        : initialState.volume,
      repeatMode: PLAYER_REPEAT_SEQUENCE.includes(saved.repeatMode) ? saved.repeatMode : initialState.repeatMode,
      isShuffle: Boolean(saved.isShuffle),
      duration: Number(saved.queue[currentIndex]?.duration) || 0,
    };
  } catch {
    return initialState;
  }
}

export function playerReducer(state, action) {
  switch (action.type) {
    case 'PLAY_SONG':
      return {
        ...state,
        currentSong: action.payload,
        isPlaying: true,
        queue: action.queue?.length ? action.queue : state.queue.length ? state.queue : [action.payload],
        currentIndex: action.index ?? state.currentIndex,
        progress: 0,
        duration: Number(action.payload?.duration) || 0,
        error: '',
        streamNonce: state.streamNonce + 1,
      };
    case 'TOGGLE_PLAY':
      return state.currentSong ? { ...state, isPlaying: !state.isPlaying } : state;
    case 'SET_PLAYING':
      return { ...state, isPlaying: action.payload };
    case 'SET_QUEUE':
      return { ...state, queue: action.payload, currentIndex: 0 };
    case 'SET_SERVER_QUEUE': {
      const queue = action.payload.queue || [];
      const currentIndex = Math.min(
        Math.max(Number(action.payload.currentIndex) || 0, 0),
        Math.max(queue.length - 1, 0),
      );
      return {
        ...state,
        queue,
        currentIndex,
        currentSong: queue[currentIndex] || null,
        repeatMode: action.payload.repeatMode || state.repeatMode,
        isShuffle: Boolean(action.payload.isShuffle),
        duration: Number(queue[currentIndex]?.duration) || 0,
      };
    }
    case 'REMOVE_QUEUE_ITEM': {
      const removeIndex = Number(action.index);
      if (
        !Number.isInteger(removeIndex)
        || removeIndex < 0
        || removeIndex >= state.queue.length
        || removeIndex === state.currentIndex
      ) {
        return state;
      }

      const queue = state.queue.filter((_, index) => index !== removeIndex);
      return {
        ...state,
        queue,
        currentIndex: removeIndex < state.currentIndex ? state.currentIndex - 1 : state.currentIndex,
      };
    }
    case 'MOVE_QUEUE_ITEM': {
      const fromIndex = Number(action.fromIndex);
      const toIndex = Number(action.toIndex);
      if (
        !Number.isInteger(fromIndex)
        || !Number.isInteger(toIndex)
        || fromIndex < 0
        || toIndex < 0
        || fromIndex >= state.queue.length
        || toIndex >= state.queue.length
        || fromIndex === toIndex
      ) {
        return state;
      }

      const queue = [...state.queue];
      const [movedSong] = queue.splice(fromIndex, 1);
      queue.splice(toIndex, 0, movedSong);
      const currentIndex = queue.findIndex((song) => song.id === state.currentSong?.id);
      return { ...state, queue, currentIndex: currentIndex >= 0 ? currentIndex : state.currentIndex };
    }
    case 'CLEAR_UPCOMING':
      return { ...state, queue: state.queue.slice(0, state.currentIndex + 1) };
    case 'NEXT': {
      if (!state.queue.length) return state;
      if (state.repeatMode === PLAYER_REPEAT_MODES.ONE) {
        return { ...state, progress: 0, isPlaying: true, streamNonce: state.streamNonce + 1 };
      }
      const nextIndex = state.isShuffle
        ? Math.floor(Math.random() * state.queue.length)
        : state.currentIndex + 1;
      if (nextIndex >= state.queue.length) {
        if (state.repeatMode !== PLAYER_REPEAT_MODES.ALL) return { ...state, isPlaying: false };
        return { ...state, currentIndex: 0, currentSong: state.queue[0], progress: 0, isPlaying: true, streamNonce: state.streamNonce + 1 };
      }
      return { ...state, currentIndex: nextIndex, currentSong: state.queue[nextIndex], progress: 0, isPlaying: true, streamNonce: state.streamNonce + 1 };
    }
    case 'PREVIOUS': {
      if (!state.queue.length) return state;
      const previousIndex = state.progress > 3 ? state.currentIndex : Math.max(state.currentIndex - 1, 0);
      return {
        ...state,
        currentIndex: previousIndex,
        currentSong: state.queue[previousIndex],
        progress: 0,
        isPlaying: true,
        streamNonce: state.streamNonce + 1,
      };
    }
    case 'SET_PROGRESS':
      return { ...state, progress: action.payload };
    case 'SET_DURATION':
      return { ...state, duration: action.payload };
    case 'SET_VOLUME':
      return { ...state, volume: action.payload };
    case 'TOGGLE_REPEAT': {
      const currentModeIndex = PLAYER_REPEAT_SEQUENCE.indexOf(state.repeatMode);
      const nextMode = PLAYER_REPEAT_SEQUENCE[(currentModeIndex + 1) % PLAYER_REPEAT_SEQUENCE.length];
      return { ...state, repeatMode: nextMode };
    }
    case 'TOGGLE_SHUFFLE':
      return { ...state, isShuffle: !state.isShuffle };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isPlaying: false };
    default:
      return state;
  }
}

function createDemoAudioUrl() {
  const sampleRate = 8000;
  const seconds = 3;
  const samples = sampleRate * seconds;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const write = (offset, text) => [...text].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  write(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  write(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, samples * 2, true);
  for (let index = 0; index < samples; index += 1) {
    const fade = Math.min(1, index / 500, (samples - index) / 500);
    view.setInt16(44 + index * 2, Math.sin((2 * Math.PI * 220 * index) / sampleRate) * 1800 * fade, true);
  }
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  const { user } = useUser();
  const [state, dispatch] = useReducer(playerReducer, PLAYER_INITIAL_STATE, initializePlayerState);
  const audioRef = useRef(null);
  const fallbackSongRef = useRef('');
  const fallbackUrlRef = useRef('');
  const serverQueueLoadedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      serverQueueLoadedRef.current = false;
      return;
    }
    getPlaybackQueue().then((result) => {
      if (!result.success) return;
      serverQueueLoadedRef.current = true;
      if (result.data.queue.length) dispatch({ type: 'SET_SERVER_QUEUE', payload: result.data });
    });
  }, [user]);

  const playSong = useCallback((song, songs = []) => {
    if (!song) return;
    const queue = Array.isArray(songs) && songs.length ? songs : [song];
    const index = Math.max(queue.findIndex((item) => item.id === song.id), 0);
    dispatch({ type: 'PLAY_SONG', payload: song, queue, index });
  }, []);

  const next = useCallback(() => {
    if (state.repeatMode === PLAYER_REPEAT_MODES.ONE && audioRef.current) {
      audioRef.current.currentTime = 0;
      dispatch({ type: 'NEXT' });
      audioRef.current.play().catch(() => dispatch({ type: 'SET_ERROR', payload: 'پخش دوباره آهنگ ممکن نشد.' }));
      return;
    }

    dispatch({ type: 'NEXT' });
  }, [state.repeatMode]);
  const previous = useCallback(() => {
    if (state.progress > 3 && audioRef.current) audioRef.current.currentTime = 0;
    dispatch({ type: 'PREVIOUS' });
  }, [state.progress]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !state.currentSong) return;
    fallbackSongRef.current = '';
    audio.src = state.currentSong.src || '';
    audio.load();
    if (state.isPlaying) audio.play().catch(() => {});
  }, [state.currentSong]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !state.currentSong) return;
    if (state.isPlaying) audio.play().catch(() => {});
    else audio.pause();
  }, [state.isPlaying, state.currentSong]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = state.volume;
  }, [state.volume]);

  useEffect(() => {
    if (!state.currentSong || state.streamNonce === 0) return undefined;
    let active = true;
    incrementPlayCount(state.currentSong.id).then((result) => {
      if (active && !result.success) {
        dispatch({ type: 'SET_ERROR', payload: result.error?.message || 'ثبت استریم ممکن نشد.' });
      }
    });
    return () => {
      active = false;
    };
  }, [state.streamNonce]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.PLAYER_STATE, JSON.stringify({
        queue: state.queue,
        currentIndex: state.currentIndex,
        volume: state.volume,
        repeatMode: state.repeatMode,
        isShuffle: state.isShuffle,
      }));
    } catch {
      // Playback remains functional when browser storage is unavailable.
    }
  }, [state.queue, state.currentIndex, state.volume, state.repeatMode, state.isShuffle]);

  useEffect(() => {
    if (!user || !serverQueueLoadedRef.current) return undefined;
    const timeout = window.setTimeout(() => {
      updatePlaybackQueue(state.queue, state.currentIndex, state.repeatMode, state.isShuffle);
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [user, state.queue, state.currentIndex, state.repeatMode, state.isShuffle]);

  useEffect(() => () => {
    if (fallbackUrlRef.current) URL.revokeObjectURL(fallbackUrlRef.current);
  }, []);

  const seek = (value) => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextTime = Math.max(0, Math.min(Number(value) || 0, state.duration || audio.duration || 0));
    audio.currentTime = nextTime;
    dispatch({ type: 'SET_PROGRESS', payload: nextTime });
  };

  const setVolume = (value) => {
    const nextVolume = Math.max(0, Math.min(Number(value), 1));
    dispatch({ type: 'SET_VOLUME', payload: nextVolume });
  };

  const handleError = () => {
    if (!state.currentSong || fallbackSongRef.current === state.currentSong.id) {
      dispatch({ type: 'SET_ERROR', payload: 'فایل صوتی این اثر در دسترس نیست.' });
      return;
    }
    fallbackSongRef.current = state.currentSong.id;
    if (fallbackUrlRef.current) URL.revokeObjectURL(fallbackUrlRef.current);
    fallbackUrlRef.current = createDemoAudioUrl();
    const audio = audioRef.current;
    if (audio) {
      audio.src = fallbackUrlRef.current;
      audio.load();
      audio.play().catch(() => dispatch({ type: 'SET_ERROR', payload: 'پخش فایل صوتی ممکن نشد.' }));
    }
  };

  return (
    <PlayerContext.Provider
      value={{
        ...state,
        audioRef,
        playSong,
        setQueue: (songs) => dispatch({ type: 'SET_QUEUE', payload: Array.isArray(songs) ? songs : [] }),
        removeQueueItem: (index) => dispatch({ type: 'REMOVE_QUEUE_ITEM', index }),
        moveQueueItem: (fromIndex, toIndex) => dispatch({ type: 'MOVE_QUEUE_ITEM', fromIndex, toIndex }),
        clearUpcoming: () => dispatch({ type: 'CLEAR_UPCOMING' }),
        togglePlay: () => dispatch({ type: 'TOGGLE_PLAY' }),
        next,
        previous,
        toggleRepeat: () => dispatch({ type: 'TOGGLE_REPEAT' }),
        toggleShuffle: () => dispatch({ type: 'TOGGLE_SHUFFLE' }),
        setVolume,
        seek,
      }}
    >
      {children}
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={(event) => dispatch({ type: 'SET_PROGRESS', payload: event.currentTarget.currentTime || 0 })}
        onLoadedMetadata={(event) => dispatch({ type: 'SET_DURATION', payload: event.currentTarget.duration || Number(state.currentSong?.duration) || 0 })}
        onPlay={() => dispatch({ type: 'SET_PLAYING', payload: true })}
        onPause={() => dispatch({ type: 'SET_PLAYING', payload: false })}
        onEnded={next}
        onError={handleError}
      />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within a PlayerProvider');
  return context;
}

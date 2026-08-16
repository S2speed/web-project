'use client';

import { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react';
import { getPlaybackQueue, incrementPlayCount, updatePlaybackQueue } from '@/lib/api';
import { useUser } from '@/contexts/UserContext';
import {
  PLAYER_AUDIO_QUALITIES,
  PLAYER_CROSSFADE_SECONDS,
  PLAYER_REPEAT_MODES,
  PLAYER_REPEAT_SEQUENCE,
  STORAGE_KEYS,
} from '@/utils/constants';

export const PLAYER_INITIAL_STATE = {
  currentSong: null,
  isPlaying: false,
  queue: [],
  currentIndex: 0,
  volume: 0.7,
  repeatMode: PLAYER_REPEAT_MODES.NONE,
  isShuffle: false,
  isCrossfadeEnabled: false,
  audioQuality: 'high',
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
      isCrossfadeEnabled: Boolean(saved.isCrossfadeEnabled),
      audioQuality: PLAYER_AUDIO_QUALITIES.includes(saved.audioQuality) ? saved.audioQuality : initialState.audioQuality,
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
      const requestedIndex = Number(action.index);
      const nextIndex = Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < state.queue.length
        ? requestedIndex
        : state.isShuffle
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
    case 'SET_AUDIO_QUALITY':
      return PLAYER_AUDIO_QUALITIES.includes(action.payload)
        ? { ...state, audioQuality: action.payload, error: '' }
        : state;
    case 'TOGGLE_REPEAT': {
      const currentModeIndex = PLAYER_REPEAT_SEQUENCE.indexOf(state.repeatMode);
      const nextMode = PLAYER_REPEAT_SEQUENCE[(currentModeIndex + 1) % PLAYER_REPEAT_SEQUENCE.length];
      return { ...state, repeatMode: nextMode };
    }
    case 'TOGGLE_SHUFFLE':
      return { ...state, isShuffle: !state.isShuffle };
    case 'TOGGLE_CROSSFADE':
      return { ...state, isCrossfadeEnabled: !state.isCrossfadeEnabled };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isPlaying: false };
    default:
      return state;
  }
}

export function resolveSongAudio(song, preferredQuality = 'high') {
  if (!song) return { quality: preferredQuality, source: '' };
  const sources = song.audioSources || {};
  const availableQualities = PLAYER_AUDIO_QUALITIES.filter((quality) => sources[quality]);
  if (!availableQualities.length && song.src) return { quality: 'high', source: song.src };

  const quality = availableQualities.includes(preferredQuality)
    ? preferredQuality
    : availableQualities.includes(song.defaultQuality)
      ? song.defaultQuality
      : availableQualities.includes('high')
        ? 'high'
        : availableQualities[0];
  return { quality: quality || preferredQuality, source: sources[quality] || song.src || '' };
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
  const audioElementsRef = useRef([null, null]);
  const activeAudioIndexRef = useRef(0);
  const crossfadeRef = useRef(null);
  const crossfadeCommitRef = useRef('');
  const volumeRef = useRef(state.volume);
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

  const cancelCrossfade = useCallback(() => {
    const fade = crossfadeRef.current;
    if (!fade) return;
    window.cancelAnimationFrame(fade.animationFrame);
    fade.incoming.pause();
    fade.incoming.currentTime = 0;
    fade.incoming.volume = 0;
    fade.outgoing.volume = volumeRef.current;
    crossfadeRef.current = null;
  }, []);

  const next = useCallback(() => {
    cancelCrossfade();
    if (state.repeatMode === PLAYER_REPEAT_MODES.ONE && audioRef.current) {
      audioRef.current.currentTime = 0;
      dispatch({ type: 'NEXT' });
      audioRef.current.play().catch(() => dispatch({ type: 'SET_ERROR', payload: 'پخش دوباره آهنگ ممکن نشد.' }));
      return;
    }

    dispatch({ type: 'NEXT' });
  }, [cancelCrossfade, state.repeatMode]);
  const previous = useCallback(() => {
    cancelCrossfade();
    if (state.progress > 3 && audioRef.current) audioRef.current.currentTime = 0;
    dispatch({ type: 'PREVIOUS' });
  }, [cancelCrossfade, state.progress]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !state.currentSong) return;
    if (crossfadeRef.current && crossfadeCommitRef.current !== state.currentSong.id) cancelCrossfade();
    fallbackSongRef.current = '';
    if (crossfadeCommitRef.current === state.currentSong.id) {
      crossfadeCommitRef.current = '';
      dispatch({ type: 'SET_PROGRESS', payload: audio.currentTime || 0 });
      dispatch({ type: 'SET_DURATION', payload: audio.duration || Number(state.currentSong.duration) || 0 });
      return;
    }
    audio.src = resolveSongAudio(state.currentSong, state.audioQuality).source;
    audio.load();
    if (state.isPlaying) audio.play().catch(() => {});
  }, [cancelCrossfade, state.currentSong]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !state.currentSong) return;
    if (state.isPlaying) audio.play().catch(() => {});
    else {
      cancelCrossfade();
      audio.pause();
    }
  }, [cancelCrossfade, state.isPlaying, state.currentSong]);

  useEffect(() => {
    volumeRef.current = state.volume;
    const fade = crossfadeRef.current;
    if (fade) {
      fade.outgoing.volume = state.volume * (1 - fade.progress);
      fade.incoming.volume = state.volume * fade.progress;
    } else if (audioRef.current) audioRef.current.volume = state.volume;
  }, [state.volume]);

  useEffect(() => {
    if (!state.isCrossfadeEnabled) cancelCrossfade();
  }, [cancelCrossfade, state.isCrossfadeEnabled]);

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
        isCrossfadeEnabled: state.isCrossfadeEnabled,
        audioQuality: state.audioQuality,
      }));
    } catch {
      // Playback remains functional when browser storage is unavailable.
    }
  }, [state.queue, state.currentIndex, state.volume, state.repeatMode, state.isShuffle, state.isCrossfadeEnabled, state.audioQuality]);

  useEffect(() => {
    if (!user || !serverQueueLoadedRef.current) return undefined;
    const timeout = window.setTimeout(() => {
      updatePlaybackQueue(state.queue, state.currentIndex, state.repeatMode, state.isShuffle);
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [user, state.queue, state.currentIndex, state.repeatMode, state.isShuffle]);

  useEffect(() => () => {
    cancelCrossfade();
    if (fallbackUrlRef.current) URL.revokeObjectURL(fallbackUrlRef.current);
  }, [cancelCrossfade]);

  const finishCrossfade = useCallback(() => {
    const fade = crossfadeRef.current;
    if (!fade) return;
    window.cancelAnimationFrame(fade.animationFrame);
    activeAudioIndexRef.current = fade.incomingIndex;
    audioRef.current = fade.incoming;
    fade.outgoing.pause();
    fade.outgoing.volume = volumeRef.current;
    fade.incoming.volume = volumeRef.current;
    crossfadeCommitRef.current = fade.nextSong.id;
    crossfadeRef.current = null;
    dispatch({ type: 'NEXT', index: fade.nextIndex });
  }, []);

  const startCrossfade = useCallback((outgoing) => {
    if (
      crossfadeRef.current
      || !state.isCrossfadeEnabled
      || !state.isPlaying
      || state.repeatMode === PLAYER_REPEAT_MODES.ONE
      || state.queue.length < 2
    ) return;

    const remaining = outgoing.duration - outgoing.currentTime;
    if (!Number.isFinite(remaining) || remaining > PLAYER_CROSSFADE_SECONDS || remaining <= 0) return;

    let nextIndex = state.isShuffle
      ? Math.floor(Math.random() * state.queue.length)
      : state.currentIndex + 1;
    if (nextIndex >= state.queue.length) {
      if (state.repeatMode !== PLAYER_REPEAT_MODES.ALL) return;
      nextIndex = 0;
    }
    if (nextIndex === state.currentIndex && state.queue.length > 1) {
      nextIndex = (nextIndex + 1) % state.queue.length;
    }

    const nextSong = state.queue[nextIndex];
    const nextSource = resolveSongAudio(nextSong, state.audioQuality).source;
    if (!nextSource) return;
    const incomingIndex = activeAudioIndexRef.current === 0 ? 1 : 0;
    const incoming = audioElementsRef.current[incomingIndex];
    if (!incoming) return;

    incoming.pause();
    incoming.src = nextSource;
    incoming.currentTime = 0;
    incoming.volume = 0;
    incoming.load();

    const fade = {
      animationFrame: 0,
      incoming,
      incomingIndex,
      nextIndex,
      nextSong,
      outgoing,
      progress: 0,
      startedAt: performance.now(),
    };
    crossfadeRef.current = fade;

    incoming.play().then(() => {
      const animate = (now) => {
        if (crossfadeRef.current !== fade) return;
        fade.progress = Math.min((now - fade.startedAt) / (PLAYER_CROSSFADE_SECONDS * 1000), 1);
        fade.outgoing.volume = volumeRef.current * (1 - fade.progress);
        fade.incoming.volume = volumeRef.current * fade.progress;
        if (fade.progress >= 1) finishCrossfade();
        else fade.animationFrame = window.requestAnimationFrame(animate);
      };
      fade.animationFrame = window.requestAnimationFrame(animate);
    }).catch(cancelCrossfade);
  }, [cancelCrossfade, finishCrossfade, state.audioQuality, state.currentIndex, state.isCrossfadeEnabled, state.isPlaying, state.isShuffle, state.queue, state.repeatMode]);

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

  const setAudioQuality = (quality) => {
    if (!PLAYER_AUDIO_QUALITIES.includes(quality) || !state.currentSong) return;
    const { quality: resolvedQuality, source } = resolveSongAudio(state.currentSong, quality);
    if (resolvedQuality !== quality || !source) return;

    const audio = audioRef.current;
    dispatch({ type: 'SET_AUDIO_QUALITY', payload: quality });
    if (!audio || audio.src === source) return;

    cancelCrossfade();
    fallbackSongRef.current = '';
    const playbackTime = audio.currentTime || 0;
    const shouldResume = state.isPlaying;
    audio.src = source;
    audio.addEventListener('loadedmetadata', () => {
      audio.currentTime = Math.min(playbackTime, Number.isFinite(audio.duration) ? audio.duration : playbackTime);
      dispatch({ type: 'SET_PROGRESS', payload: audio.currentTime || 0 });
      dispatch({ type: 'SET_DURATION', payload: audio.duration || Number(state.currentSong?.duration) || 0 });
      if (shouldResume) audio.play().catch(() => dispatch({ type: 'SET_ERROR', payload: 'تغییر کیفیت پخش ممکن نشد.' }));
    }, { once: true });
    audio.load();
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
        toggleCrossfade: () => dispatch({ type: 'TOGGLE_CROSSFADE' }),
        setAudioQuality,
        activeAudioQuality: resolveSongAudio(state.currentSong, state.audioQuality).quality,
        availableAudioQualities: PLAYER_AUDIO_QUALITIES.filter((quality) => state.currentSong?.audioSources?.[quality] || (quality === 'high' && state.currentSong?.src)),
        setVolume,
        seek,
      }}
    >
      {children}
      {[0, 1].map((audioIndex) => (
      <audio
        key={audioIndex}
        ref={(node) => {
          audioElementsRef.current[audioIndex] = node;
          if (audioIndex === activeAudioIndexRef.current) audioRef.current = node;
        }}
        preload="metadata"
        onTimeUpdate={(event) => {
          if (event.currentTarget !== audioRef.current) return;
          dispatch({ type: 'SET_PROGRESS', payload: event.currentTarget.currentTime || 0 });
          startCrossfade(event.currentTarget);
        }}
        onLoadedMetadata={(event) => {
          if (event.currentTarget === audioRef.current) dispatch({ type: 'SET_DURATION', payload: event.currentTarget.duration || Number(state.currentSong?.duration) || 0 });
        }}
        onPlay={(event) => {
          if (event.currentTarget === audioRef.current) dispatch({ type: 'SET_PLAYING', payload: true });
        }}
        onPause={(event) => {
          if (event.currentTarget === audioRef.current) dispatch({ type: 'SET_PLAYING', payload: false });
        }}
        onEnded={(event) => {
          if (event.currentTarget !== audioRef.current) return;
          if (crossfadeRef.current) finishCrossfade();
          else next();
        }}
        onError={(event) => {
          if (event.currentTarget === audioRef.current) handleError();
          else if (crossfadeRef.current?.incoming === event.currentTarget) cancelCrossfade();
        }}
      />
      ))}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within a PlayerProvider');
  return context;
}

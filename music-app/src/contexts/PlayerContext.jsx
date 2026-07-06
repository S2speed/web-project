'use client';

import { createContext, useContext, useRef, useReducer } from 'react';
import { incrementPlayCount } from '@/lib/mockApi';

const initialState = {
  currentSong: null,
  isPlaying: false,
  queue: [],
  currentIndex: 0,
  volume: 0.7,
  repeatMode: 'none',
  isShuffle: false,
  progress: 0,
  duration: 0,
};

function playerReducer(state, action) {
  switch (action.type) {
    case 'PLAY_SONG':
      return {
        ...state,
        currentSong: action.payload,
        isPlaying: true,
        currentIndex: action.index ?? state.currentIndex,
      };
    case 'TOGGLE_PLAY':
      return { ...state, isPlaying: !state.isPlaying };
    case 'SET_QUEUE':
      return { ...state, queue: action.payload, currentIndex: 0 };
    case 'NEXT': {
      if (!state.queue.length) {
        return state;
      }

      const nextIndex = state.currentIndex + 1;

      if (nextIndex >= state.queue.length) {
        if (state.repeatMode === 'all') {
          return { ...state, currentIndex: 0, currentSong: state.queue[0], isPlaying: true };
        }

        return state;
      }

      return {
        ...state,
        currentIndex: nextIndex,
        currentSong: state.queue[nextIndex],
        isPlaying: true,
      };
    }
    case 'PREVIOUS': {
      if (!state.queue.length) {
        return state;
      }

      const previousIndex = Math.max(state.currentIndex - 1, 0);

      return {
        ...state,
        currentIndex: previousIndex,
        currentSong: state.queue[previousIndex],
        isPlaying: true,
      };
    }
    case 'SET_PROGRESS':
      return { ...state, progress: action.payload };
    case 'SET_VOLUME':
      return { ...state, volume: action.payload };
    case 'TOGGLE_REPEAT': {
      const modes = ['none', 'all', 'one'];
      const currentModeIndex = modes.indexOf(state.repeatMode);
      const nextMode = modes[(currentModeIndex + 1) % modes.length];
      return { ...state, repeatMode: nextMode };
    }
    case 'TOGGLE_SHUFFLE':
      return { ...state, isShuffle: !state.isShuffle };
    default:
      return state;
  }
}

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  const [state, dispatch] = useReducer(playerReducer, initialState);
  const audioRef = useRef(null);

  const playSong = (song) => {
    dispatch({ type: 'PLAY_SONG', payload: song });
    incrementPlayCount(song.id);
  };

  const togglePlay = () => {
    dispatch({ type: 'TOGGLE_PLAY' });
  };

  const next = () => {
    dispatch({ type: 'NEXT' });
  };

  const previous = () => {
    dispatch({ type: 'PREVIOUS' });
  };

  const toggleRepeat = () => {
    dispatch({ type: 'TOGGLE_REPEAT' });
  };

  const toggleShuffle = () => {
    dispatch({ type: 'TOGGLE_SHUFFLE' });
  };

  const setVolume = (volume) => {
    dispatch({ type: 'SET_VOLUME', payload: volume });
  };

  return (
    <PlayerContext.Provider
      value={{
        ...state,
        audioRef,
        playSong,
        togglePlay,
        next,
        previous,
        toggleRepeat,
        toggleShuffle,
        setVolume,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);

  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }

  return context;
}
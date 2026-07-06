'use client';

import { createContext, useContext, useEffect, useReducer } from 'react';
import { getCurrentUser, login as apiLogin, logout as apiLogout } from '@/lib/mockApi';

const initialState = {
  user: null,
  isLoading: true,
  error: null,
};

function userReducer(state, action) {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload, isLoading: false, error: null };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'LOGOUT':
      return { ...state, user: null, isLoading: false, error: null };
    default:
      return state;
  }
}

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [state, dispatch] = useReducer(userReducer, initialState);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      const result = await getCurrentUser();

      if (!isMounted) {
        return;
      }

      if (result.success) {
        dispatch({ type: 'SET_USER', payload: result.data });
      } else {
        dispatch({ type: 'SET_USER', payload: null });
      }
    };

    loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email, password) => {
    dispatch({ type: 'SET_LOADING', payload: true });

    const result = await apiLogin(email, password);

    if (result.success) {
      dispatch({ type: 'SET_USER', payload: result.data.user });
    } else {
      dispatch({ type: 'SET_ERROR', payload: result.error.message });
    }

    return result;
  };

  const logout = async () => {
    await apiLogout();
    dispatch({ type: 'LOGOUT' });
  };

  return <UserContext.Provider value={{ ...state, login, logout }}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }

  return context;
}
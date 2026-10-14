import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api.js';
import { disconnectSocket } from '../services/socket.js';
import { User } from '../types/index.js';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (payload: {
    displayName: string;
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updatedUser: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

const getToken = () => (typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('drawmate_token') : null);
const setToken = (token: string) => {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem('drawmate_token', token);
  }
};
const removeToken = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem('drawmate_token');
  }
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      // First attempt to fetch me directly with stored token or cookies
      const res = await api.get('/auth/me');
      if (isMountedRef.current && res.data?.success && res.data?.user) {
        setUser(res.data.user);
      }
    } catch {
      // If access token expired, try refreshing with refresh token cookie
      try {
        const refreshRes = await api.post('/auth/refresh');
        if (refreshRes.data?.success && refreshRes.data?.accessToken) {
          setToken(refreshRes.data.accessToken);
          if (isMountedRef.current) {
            setUser(refreshRes.data.user);
          }
        } else {
          removeToken();
          disconnectSocket();
          if (isMountedRef.current) {
            setUser(null);
          }
        }
      } catch {
        removeToken();
        disconnectSocket();
        if (isMountedRef.current) {
          setUser(null);
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (identifier: string, password: string) => {
    const res = await api.post('/auth/login', { identifier, password });
    if (res.data.success) {
      disconnectSocket();
      if (res.data.accessToken) {
        setToken(res.data.accessToken);
      }
      setUser(res.data.user);
    }
  };

  const register = async (payload: {
    displayName: string;
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => {
    const res = await api.post('/auth/register', payload);
    if (res.data.success) {
      disconnectSocket();
      if (res.data.accessToken) {
        setToken(res.data.accessToken);
      }
      setUser(res.data.user);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      console.warn('Logout API notification failed', e);
    } finally {
      disconnectSocket();
      removeToken();
      setUser(null);
    }
  };

  const updateUser = (updatedFields: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updatedFields } : null));
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data?.success) {
        setUser(res.data.user);
      }
    } catch (e) {
      console.warn('Failed to refresh user profile data', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        updateUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

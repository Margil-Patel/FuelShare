'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@/lib/api/types';
import { getMeApi, loginApi, logoutApi, registerApi } from '@/lib/api/auth';
import { getAuthToken } from '@/lib/api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string, phone?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const storedToken = getAuthToken();
      if (!storedToken) {
        setUser(null);
        setToken(null);
        setIsLoading(false);
        return;
      }
      setToken(storedToken);
      const currentUser = await getMeApi();
      setUser(currentUser);
    } catch (err: unknown) {
      // Gracefully clear stale or expired session tokens without throwing uncaught dev console errors
      logoutApi();
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const auth = await loginApi(email, pass);
      setToken(auth.access_token);
      const currentUser = await getMeApi();
      setUser(currentUser);
    } catch (err: any) {
      const msg = err.detail || err.message || 'Login failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, pass: string, phone?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await registerApi(name, email, pass, phone);
      // Auto login after register
      await login(email, pass);
    } catch (err: any) {
      const msg = err.detail || err.message || 'Registration failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    logoutApi();
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        error,
        login,
        register,
        logout,
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

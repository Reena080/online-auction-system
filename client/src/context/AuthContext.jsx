import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('bellcorp_auction_token'));
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = useCallback(async () => {
    const storedToken = localStorage.getItem('bellcorp_auction_token');
    if (!storedToken) {
      setLoading(false);
      return;
    }

    try {
      const response = await api.auth.getMe();
      if (response.success && response.data) {
        setUser(response.data);
      }
    } catch (error) {
      console.warn('[AUTH] Session expired or invalid:', error.message);
      localStorage.removeItem('bellcorp_auction_token');
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = async (email, password) => {
    const response = await api.auth.login({ email, password });
    if (response.success && response.data) {
      const { user: userData, token: jwtToken } = response.data;
      localStorage.setItem('bellcorp_auction_token', jwtToken);
      setToken(jwtToken);
      setUser(userData);
      return userData;
    }
  };

  const register = async (name, email, password) => {
    const response = await api.auth.register({ name, email, password });
    if (response.success && response.data) {
      const { user: userData, token: jwtToken } = response.data;
      localStorage.setItem('bellcorp_auction_token', jwtToken);
      setToken(jwtToken);
      setUser(userData);
      return userData;
    }
  };

  const logout = () => {
    localStorage.removeItem('bellcorp_auction_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        loading,
        login,
        register,
        logout
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

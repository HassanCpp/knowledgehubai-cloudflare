import React, { createContext, useState, useEffect, useContext } from 'react';
import { API_URL } from '../config/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('kh_token') || null);
  const [loading, setLoading] = useState(true);

  // Helper for authenticated API calls — includes JWT automatically
  const apiFetch = async (endpoint, options = {}) => {
    const currentToken = localStorage.getItem('kh_token');
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });

    if (!response.ok) {
      // Worker returns { error: '...' } — handle both message and error keys
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || data.message || `Request failed (${response.status})`);
    }

    return response.json();
  };

  // Verify token and restore user session on startup
  useEffect(() => {
    const initAuth = async () => {
      const stored = localStorage.getItem('kh_token');
      if (stored) {
        try {
          const profile = await apiFetch('/auth/me');
          setUser(profile);
        } catch (error) {
          // Only clear token on explicit 401, not network errors
          if (error.message.includes('401') || error.message.toLowerCase().includes('unauthorized')) {
            localStorage.removeItem('kh_token');
            setToken(null);
          }
          // else keep the token — transient errors shouldn't log the user out
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []); // run once on mount only

  const login = async (email, password) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Login failed');
    }
    localStorage.setItem('kh_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (email, password) => {
    // Worker accepts { email, password } only — no username field
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Registration failed');
    }
    return data;
  };

  const logout = () => {
    const currentToken = localStorage.getItem('kh_token');
    if (currentToken) {
      fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` },
      }).catch(() => {});
    }
    localStorage.removeItem('kh_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

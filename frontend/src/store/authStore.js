import { create } from 'zustand';
import { refreshTokenApi } from '../api/auth.api';

const TOKEN_KEY = 'erp_token';
const USER_KEY = 'erp_user';

const useAuthStore = create((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  isInitializing: true,

  login: (accessToken, user) => {
    try {
      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (_) {}
    set({ accessToken, user, isAuthenticated: true });
  },

  logout: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (_) {}
    set({ accessToken: null, user: null, isAuthenticated: false });
  },

  setToken: (accessToken) => {
    try {
      localStorage.setItem(TOKEN_KEY, accessToken);
    } catch (_) {}
    set({ accessToken, isAuthenticated: true });
  },

  initialize: async () => {
    // 1. Try refresh token cookie (server issues a fresh access token)
    try {
      const response = await refreshTokenApi();
      if (response.data && response.data.data) {
        const { accessToken, user } = response.data.data;
        try {
          localStorage.setItem(TOKEN_KEY, accessToken);
          localStorage.setItem(USER_KEY, JSON.stringify(user));
        } catch (_) {}
        set({ accessToken, user, isAuthenticated: true, isInitializing: false });
        return;
      }
    } catch (_) {
      // Refresh token cookie failed or not present — fall through to localStorage
    }

    // 2. Fallback: use stored token (8h expiry; 401 interceptor handles expiry gracefully)
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const userRaw = localStorage.getItem(USER_KEY);
      if (token && userRaw) {
        set({
          accessToken: token,
          user: JSON.parse(userRaw),
          isAuthenticated: true,
          isInitializing: false,
        });
        return;
      }
    } catch (_) {}

    set({ isInitializing: false, isAuthenticated: false });
  },
}));

export default useAuthStore;

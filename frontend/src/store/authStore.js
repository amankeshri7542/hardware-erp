import { create } from 'zustand';
import { refreshTokenApi } from '../api/auth.api';

const useAuthStore = create((set, get) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  isInitializing: true,

  login: (accessToken, user) => {
    set({ accessToken, user, isAuthenticated: true });
  },

  logout: () => {
    set({ accessToken: null, user: null, isAuthenticated: false });
  },

  setToken: (accessToken) => {
    set({ accessToken, isAuthenticated: true });
  },

  initialize: async () => {
    try {
      const response = await refreshTokenApi();
      if (response.data && response.data.data) {
        const { accessToken, user } = response.data.data;
        set({ accessToken, user, isAuthenticated: true, isInitializing: false });
      } else {
        set({ isInitializing: false });
      }
    } catch (error) {
      set({ isInitializing: false, isAuthenticated: false });
    }
  }
}));

export default useAuthStore;

import axios from 'axios';
import useAuthStore from '../store/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — redirect to login
// IMPORTANT: Exclude /auth/refresh from this interceptor.
// If we intercept 401s from the refresh endpoint itself, we get an
// infinite loop: refresh fails → 401 → interceptor fires → logout → redirect.
// Instead, let the authStore.initialize() catch block handle refresh failures gracefully.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isRefreshEndpoint = error.config?.url?.includes('/auth/refresh');
    if (error.response && error.response.status === 401 && !isRefreshEndpoint) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;

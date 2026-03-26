import api from './axios';

export const loginApi = (data) => api.post('/auth/login', data);
export const logoutApi = () => api.post('/auth/logout');
export const refreshTokenApi = () => api.post('/auth/refresh');

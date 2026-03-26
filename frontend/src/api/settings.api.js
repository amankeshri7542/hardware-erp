import api from './axios';

export const getSettings = () => api.get('/settings');

import api from './axios';

export const createPurchase = (data) => api.post('/purchases', data);

export const getPurchases = (params) => api.get('/purchases', { params });

export const getPurchase = (id) => api.get(`/purchases/${id}`);

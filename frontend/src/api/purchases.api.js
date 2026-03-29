import api from './axios';

export const createPurchase = (data) => api.post('/purchases', data);

export const getPurchases = (params) => api.get('/purchases', { params });

export const getPurchase = (id) => api.get(`/purchases/${id}`);

export const createPurchaseReturn = (id, data) =>
  api.post(`/purchases/${id}/returns`, data);

export const getPurchaseReturns = (id) =>
  api.get(`/purchases/${id}/returns`);

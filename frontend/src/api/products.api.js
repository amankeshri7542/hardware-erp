import api from './axios';

export const getProducts = (params) => api.get('/products', { params });

export const getProduct = (id) => api.get(`/products/${id}`);

export const createProduct = (data) => api.post('/products', data);

export const updateProduct = (id, data) => api.put(`/products/${id}`, data);

export const deleteProduct = (id) => api.delete(`/products/${id}`);

export const getStockLedger = (id, params) =>
  api.get(`/products/${id}/stock-ledger`, { params });

export const getLowStockProducts = () => api.get('/products/low-stock');

export const getFrequentProducts = () => api.get('/products/frequent');

export const searchProducts = (params) => api.get('/products/search', { params });

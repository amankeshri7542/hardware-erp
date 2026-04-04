import api from './axios';

export const getProducts = (params) => api.get('/products', { params });

export const getProduct = (id) => api.get(`/products/${id}`);

export const createProduct = (data) => api.post('/products', data);

export const updateProduct = (id, data) => api.put(`/products/${id}`, data);

export const deleteProduct = (id) => api.delete(`/products/${id}`);

export const getStockLedger = (id, params) =>
  api.get(`/products/${id}/stock-ledger`, { params });

export const getLowStockProducts = () => api.get('/products/low-stock');

export const searchProducts = (params) => api.get('/products/search', { params });

export const getUnitConversions = (id) => api.get(`/products/${id}/unit-conversions`);

export const createUnitConversion = (id, data) =>
  api.post(`/products/${id}/unit-conversions`, data);

export const deleteUnitConversion = (conversionId) =>
  api.delete(`/products/unit-conversions/${conversionId}`);

export const getProductPriceHistory = (id) =>
  api.get(`/products/${id}/price-history`);

export const getProductSuppliers = (id) =>
  api.get(`/products/${id}/suppliers`);

export const linkProductSupplier = (id, data) =>
  api.post(`/products/${id}/suppliers`, data);

import api from './axios';

export const searchCustomers = (params) => api.get('/customers', { params });
export const getCustomer = (id) => api.get(`/customers/${id}`);
export const getCustomerLedger = (id, params) => api.get(`/customers/${id}/ledger`, { params });
export const createCustomer = (data) => api.post('/customers', data);
export const updateCustomer = (id, data) => api.put(`/customers/${id}`, data);
export const deactivateCustomer = (id) => api.delete(`/customers/${id}`);
export const getCustomerSummary = (id) => api.get(`/customers/${id}/summary`);
export const listCustomers = (params) => api.get('/customers', { params });

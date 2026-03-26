import api from './axios';

export const createInvoice = (data) => api.post('/invoices', data);
export const getInvoice = (id) => api.get(`/invoices/${id}`);
export const listInvoices = (params) => api.get('/invoices', { params });
export const getPdfStatus = (id) => api.get(`/invoices/${id}/pdf-status`);
export const getPdfUrl = (id) => api.get(`/invoices/${id}/pdf`);
export const processReturn = (id, data) => api.post(`/invoices/${id}/return`, data);

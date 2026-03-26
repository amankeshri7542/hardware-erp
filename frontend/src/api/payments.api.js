import api from './axios';

export const recordPayment = (data) => api.post('/payments', data);
export const listPayments = (params) => api.get('/payments', { params });
export const getInvoicePayments = (id) => api.get(`/payments/invoice/${id}`);

import api from './axios';

export const getDashboardSummary = () => api.get('/dashboard/summary');
export const getSalesOverview = (params) => api.get('/dashboard/sales-overview', { params });
export const getOverdueInvoices = (params) => api.get('/dashboard/overdue-invoices', { params });
export const getOverdueCustomers = (params) => api.get('/dashboard/overdue-customers', { params });
export const getRecentActivity = (params) => api.get('/dashboard/recent-activity', { params });
export const getPaymentModeBreakdown = (params) => api.get('/dashboard/payment-modes', { params });

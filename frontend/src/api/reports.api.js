import api from './axios';

export const getSalesReport = (params) => api.get('/reports/sales', { params });
export const getGstReport = (params) => api.get('/reports/gst', { params });
export const getStockReport = (params) => api.get('/reports/stock', { params });
export const getStockMovementReport = (params) => api.get('/reports/stock-movement', { params });
export const getCustomerDuesReport = (params) => api.get('/reports/customer-dues', { params });
export const getProfitReport = (params) => api.get('/reports/profit', { params });
export const getCollectionsReport = (params) => api.get('/reports/collections', { params });
export const getProductCategories = () => api.get('/reports/product-categories');

// Excel export — returns blob
export const exportReport = async (reportName, params = {}) => {
  const response = await api.get(`/reports/${reportName}/export`, {
    params,
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  const filename = reportName === 'full-export'
    ? `full-data-export-${new Date().toISOString().slice(0, 10)}.xlsx`
    : `${reportName}-report.xlsx`;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

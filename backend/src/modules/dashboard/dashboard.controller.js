const asyncHandler = require('../../utils/asyncHandler');
const dashboardService = require('./dashboard.service');

const getSummary = asyncHandler(async (req, res) => {
  const data = await dashboardService.getDashboardSummary();
  return res.json({ success: true, data });
});

const salesOverview = asyncHandler(async (req, res) => {
  const data = await dashboardService.getSalesOverview(req.query);
  return res.json({ success: true, data });
});

const overdueInvoices = asyncHandler(async (req, res) => {
  const data = await dashboardService.getOverdueInvoices(req.query);
  return res.json({ success: true, data });
});

const overdueCustomers = asyncHandler(async (req, res) => {
  const data = await dashboardService.getOverdueCustomers(req.query);
  return res.json({ success: true, data });
});

const recentActivity = asyncHandler(async (req, res) => {
  const data = await dashboardService.getRecentActivity(req.query);
  return res.json({ success: true, data });
});

const paymentModeBreakdown = asyncHandler(async (req, res) => {
  const data = await dashboardService.getPaymentModeBreakdown(req.query);
  return res.json({ success: true, data });
});

module.exports = {
  getSummary,
  salesOverview,
  overdueInvoices,
  overdueCustomers,
  recentActivity,
  paymentModeBreakdown,
};

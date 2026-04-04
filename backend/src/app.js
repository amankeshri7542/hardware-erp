const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : 'http://localhost:5173',
  credentials: true,
}));

// Cookie parser
app.use(cookieParser());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Hardware ERP API is running' });
});

// Mount module routers
const authRouter = require('./modules/auth/auth.router');
app.use('/api/auth', authRouter);

const productsRouter = require('./modules/products/products.router');
app.use('/api/products', productsRouter);

const { suppliersRouter, purchasesRouter } = require('./modules/purchases/purchases.router');
app.use('/api/suppliers', suppliersRouter);
app.use('/api/purchases', purchasesRouter);

const paymentsRouter = require('./modules/payments/payments.router');
app.use('/api/payments', paymentsRouter);

const invoicesRouter = require('./modules/invoices/invoices.router');
app.use('/api/invoices', invoicesRouter);

const customersRouter = require('./modules/customers/customers.router');
app.use('/api/customers', customersRouter);

const dashboardRouter = require('./modules/dashboard/dashboard.router');
app.use('/api/dashboard', dashboardRouter);

const reportsRouter = require('./modules/reports/reports.router');
const exportsRouter = require('./modules/reports/exports.router');
app.use('/api/reports', reportsRouter);
app.use('/api/reports', exportsRouter);

const settingsRouter = require('./modules/settings/settings.router');
app.use('/api/settings', settingsRouter);

// Serve Frontend in Production (fallback if nginx is not used)
// When nginx handles static files, this block is harmless but provides a safety net.
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  const frontendDistPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDistPath));

  // Only serve index.html for non-API routes (avoid catching /api/* 404s)
  app.get(/^(?!\/api).*/, (req, res, next) => {
    const indexPath = path.join(frontendDistPath, 'index.html');
    const fs = require('fs');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
}

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;


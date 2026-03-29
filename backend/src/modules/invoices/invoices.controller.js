const path = require('path');
const fs = require('fs');
const asyncHandler = require('../../utils/asyncHandler');
const invoicesService = require('./invoices.service');

/**
 * POST /api/invoices
 */
const createInvoice = asyncHandler(async (req, res) => {
  try {
    const result = await invoicesService.createInvoice(req.body, req.user.id);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    if (err.errorCode === 'INSUFFICIENT_STOCK') {
      return res.status(422).json({
        success: false,
        error: err.message,
        code: err.errorCode,
        failures: err.failures,
      });
    }
    throw err;
  }
});

/**
 * GET /api/invoices
 */
const listInvoices = asyncHandler(async (req, res) => {
  const {
    customer_id,
    from,
    to,
    status,
    bill_type,
    invoice_no,
    page = 1,
    limit = 20,
  } = req.query;

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const result = await invoicesService.listInvoices({
    customerId: customer_id ? parseInt(customer_id, 10) : undefined,
    from: from || undefined,
    to: to || undefined,
    status: status || undefined,
    billType: bill_type || undefined,
    invoiceNo: invoice_no || undefined,
    page: parsedPage,
    limit: parsedLimit,
  });

  res.json({
    success: true,
    data: {
      invoices: result.invoices,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    },
  });
});

/**
 * GET /api/invoices/:id
 */
const getInvoice = asyncHandler(async (req, res) => {
  const invoice = await invoicesService.getInvoiceById(parseInt(req.params.id, 10));
  if (!invoice) {
    return res.status(404).json({
      success: false,
      error: 'Invoice not found',
      code: 'INVOICE_NOT_FOUND',
    });
  }
  res.json({ success: true, data: invoice });
});

/**
 * GET /api/invoices/:id/pdf-status
 */
const getPdfStatus = asyncHandler(async (req, res) => {
  const result = await invoicesService.getPdfStatus(parseInt(req.params.id, 10));
  res.json({ success: true, data: result });
});

/**
 * GET /api/invoices/:id/pdf
 * For S3-stored PDFs: returns a pre-signed URL.
 * For local dev PDFs (local:// prefix): streams the file directly.
 */
const getPdf = asyncHandler(async (req, res) => {
  const result = await invoicesService.getPresignedPdfUrl(parseInt(req.params.id, 10));

  // Local dev: serve the file directly instead of returning a URL
  if (result.url && result.url.startsWith('local://')) {
    const filePath = result.url.replace('local://', '');
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'PDF file not found on disk',
        code: 'PDF_FILE_MISSING',
      });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
    return res.sendFile(filePath);
  }

  // S3: redirect to the pre-signed URL so browser opens the PDF directly
  if (result.url) {
    return res.redirect(result.url);
  }

  res.json({ success: true, data: result });
});

/**
 * POST /api/invoices/:id/regenerate-pdf
 */
const regeneratePdf = asyncHandler(async (req, res) => {
  const invoiceId = parseInt(req.params.id, 10);
  try {
    const s3Key = await invoicesService.generatePdfDirect(invoiceId);
    res.json({ success: true, data: { pdf_status: 'ready', pdf_url: s3Key } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'PDF generation failed: ' + err.message });
  }
});

/**
 * POST /api/invoices/:id/return
 */
const processReturn = asyncHandler(async (req, res) => {
  const result = await invoicesService.processReturn(req.body, req.user.id);
  res.status(201).json({ success: true, data: result });
});

module.exports = {
  createInvoice,
  listInvoices,
  getInvoice,
  getPdfStatus,
  getPdf,
  regeneratePdf,
  processReturn,
};

const purchasesService = require('./purchases.service');

// ─── SUPPLIER HANDLERS ────────────────────────────────────────────

async function createSupplier(req, res, next) {
  try {
    const supplier = await purchasesService.createSupplier(req.body);
    return res.status(201).json({ success: true, data: supplier });
  } catch (err) {
    next(err);
  }
}

async function listSuppliers(req, res, next) {
  try {
    const { search, is_active } = req.query;
    const suppliers = await purchasesService.getSuppliers({
      search: search || undefined,
      isActive: is_active !== undefined ? is_active === 'true' : undefined,
    });
    return res.json({ success: true, data: { suppliers } });
  } catch (err) {
    next(err);
  }
}

async function getSupplier(req, res, next) {
  try {
    const supplier = await purchasesService.getSupplierById(req.params.id);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found',
        code: 'SUPPLIER_NOT_FOUND',
      });
    }
    return res.json({ success: true, data: supplier });
  } catch (err) {
    next(err);
  }
}

async function updateSupplier(req, res, next) {
  try {
    const supplier = await purchasesService.updateSupplier(req.params.id, req.body);
    return res.json({ success: true, data: supplier });
  } catch (err) {
    next(err);
  }
}

// ─── PURCHASE HANDLERS ───────────────────────────────────────────

async function createPurchase(req, res, next) {
  try {
    const result = await purchasesService.createPurchaseWithStockIn(req.body, req.user.id);
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function listPurchases(req, res, next) {
  try {
    const { supplier_id, from, to, page = 1, limit = 20 } = req.query;
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const { purchases, total } = await purchasesService.getPurchases({
      supplierId: supplier_id || undefined,
      from: from || undefined,
      to: to || undefined,
      page: parsedPage,
      limit: parsedLimit,
    });

    return res.json({
      success: true,
      data: {
        purchases,
        pagination: {
          total,
          page: parsedPage,
          limit: parsedLimit,
          totalPages: Math.ceil(total / parsedLimit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getPurchase(req, res, next) {
  try {
    const purchase = await purchasesService.getPurchaseById(req.params.id);
    if (!purchase) {
      return res.status(404).json({
        success: false,
        error: 'Purchase not found',
        code: 'PURCHASE_NOT_FOUND',
      });
    }
    return res.json({ success: true, data: purchase });
  } catch (err) {
    next(err);
  }
}

// ─── SUPPLIER DETAIL HANDLERS ────────────────────────────────────

async function getSupplierProducts(req, res, next) {
  try {
    const products = await purchasesService.getSupplierProducts(req.params.id);
    return res.json({ success: true, data: { products } });
  } catch (err) {
    next(err);
  }
}

async function getSupplierDebitNotes(req, res, next) {
  try {
    const debitNotes = await purchasesService.getSupplierDebitNotes(req.params.id);
    return res.json({ success: true, data: { debit_notes: debitNotes } });
  } catch (err) {
    next(err);
  }
}

// ─── PURCHASE RETURN HANDLERS ───────────────────────────────────

async function createPurchaseReturn(req, res, next) {
  try {
    const result = await purchasesService.createPurchaseReturn(
      req.params.id, req.body, req.user.id
    );
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function getPurchaseReturns(req, res, next) {
  try {
    const returns = await purchasesService.getPurchaseReturns(req.params.id);
    return res.json({ success: true, data: { returns } });
  } catch (err) {
    next(err);
  }
}

// ─── PURCHASE INVOICE UPLOAD ─────────────────────────────────────
async function uploadInvoiceFile(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const purchaseId = req.params.id;
    const { originalname, buffer, mimetype } = req.file;
    const ext = originalname.split('.').pop().toLowerCase();
    const key = `purchase-invoices/${purchaseId}/${Date.now()}.${ext}`;

    let fileUrl;

    if (process.env.AWS_ACCESS_KEY_ID) {
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      const { s3Client } = require('../../config/aws');
      await s3Client.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      }));
      fileUrl = key;
    } else {
      // Local fallback — save to disk
      const fs = require('fs');
      const path = require('path');
      const dir = path.join(__dirname, '..', '..', '..', 'purchase-invoices', String(purchaseId));
      fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, `${Date.now()}.${ext}`);
      fs.writeFileSync(filePath, buffer);
      fileUrl = `local://${filePath}`;
    }

    await purchasesService.updatePurchaseInvoiceUrl(purchaseId, fileUrl);
    return res.json({ success: true, data: { invoice_file_url: fileUrl } });
  } catch (err) {
    next(err);
  }
}

// ─── GET PURCHASE INVOICE URL (returns JSON with a viewable URL) ─
async function getInvoiceFileUrl(req, res, next) {
  try {
    const purchase = await purchasesService.getPurchaseById(req.params.id);
    if (!purchase || !purchase.invoice_file_url) {
      return res.status(404).json({ success: false, error: 'No invoice file found' });
    }

    const { invoice_file_url } = purchase;

    if (invoice_file_url.startsWith('local://')) {
      const filePath = invoice_file_url.replace('local://', '');
      const fs = require('fs');
      const path = require('path');
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'File not found on disk' });
      }
      const fileBuffer = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
      const mime = mimeMap[ext] || 'application/octet-stream';
      const dataUrl = `data:${mime};base64,${fileBuffer.toString('base64')}`;
      return res.json({ success: true, data: { url: dataUrl } });
    }

    // S3: return pre-signed URL in JSON so frontend can open it
    const { getPresignedUrl } = require('../../utils/s3');
    const url = await getPresignedUrl(invoice_file_url, 3600);
    return res.json({ success: true, data: { url } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createSupplier,
  listSuppliers,
  getSupplier,
  updateSupplier,
  createPurchase,
  listPurchases,
  getPurchase,
  getSupplierProducts,
  getSupplierDebitNotes,
  createPurchaseReturn,
  getPurchaseReturns,
  uploadInvoiceFile,
  getInvoiceFileUrl,
};

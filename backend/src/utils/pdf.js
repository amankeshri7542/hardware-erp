// hardware-erp/backend/src/utils/pdf.js
// Generate invoice PDF with Puppeteer. Runs in worker.js, NEVER in server.js.

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const TEMPLATE_DIR = path.join(__dirname, '..', 'templates');

/**
 * Format a number as Indian currency string (e.g. 1,23,456.00).
 */
function formatCurrency(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format a date as DD/MM/YYYY.
 */
function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ─── Number to Words (Indian English) ───────────────────────────────

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
];

/**
 * Convert a number (0–9999999999) to Indian English words.
 * Uses the Indian numbering system: Crore, Lakh, Thousand, Hundred.
 */
function convertChunk(n) {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  if (n < 100) {
    const t = TENS[Math.floor(n / 10)];
    const o = ONES[n % 10];
    return o ? `${t} ${o}` : t;
  }
  if (n < 1000) {
    const h = ONES[Math.floor(n / 100)] + ' Hundred';
    const remainder = n % 100;
    return remainder ? `${h} ${convertChunk(remainder)}` : h;
  }
  return '';
}

/**
 * Convert a number to Indian English words.
 * e.g. 125000 -> 'One Lakh Twenty Five Thousand'
 * e.g. 2500.50 -> 'Two Thousand Five Hundred and Fifty Paise'
 */
function numberToWords(amount) {
  const num = parseFloat(amount) || 0;
  if (num === 0) return 'Rupees Zero Only';

  const absNum = Math.abs(num);
  const wholePart = Math.floor(absNum);
  const paisePart = Math.round((absNum - wholePart) * 100);

  let words = '';

  if (wholePart === 0) {
    words = 'Zero';
  } else {
    const crore = Math.floor(wholePart / 10000000);
    const lakh = Math.floor((wholePart % 10000000) / 100000);
    const thousand = Math.floor((wholePart % 100000) / 1000);
    const remainder = wholePart % 1000;

    const parts = [];
    if (crore > 0) parts.push(convertChunk(crore) + ' Crore');
    if (lakh > 0) parts.push(convertChunk(lakh) + ' Lakh');
    if (thousand > 0) parts.push(convertChunk(thousand) + ' Thousand');
    if (remainder > 0) parts.push(convertChunk(remainder));
    words = parts.join(' ');
  }

  let result = 'Rupees ' + words;
  if (paisePart > 0) {
    result += ' and ' + convertChunk(paisePart) + ' Paise';
  }
  result += ' Only';
  return result;
}

// ─── Conditional flags ──────────────────────────────────────────────

/**
 * Process {{#FLAG}}...content...{{/FLAG}} conditional blocks in HTML.
 * If flag is truthy: remove tags, keep content.
 * If flag is falsy: remove tags AND content.
 */
function processConditionalFlags(html, flags) {
  return html.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, flagName, content) => {
    return flags[flagName] ? content : '';
  });
}

// ─── Bill type label ────────────────────────────────────────────────

/**
 * Map bill_type DB value to display label for the PDF header.
 */
function billTypeLabel(billType) {
  const map = {
    retail: 'TAX INVOICE',
    wholesale: 'TAX INVOICE',
    quickbill: 'CASH MEMO',
  };
  return map[billType] || 'TAX INVOICE';
}

/**
 * Build GST summary rows by grouping items by gst_pct.
 */
function buildGstSummary(items) {
  const map = {};
  for (const item of items) {
    const pct = parseFloat(item.gst_pct) || 0;
    if (!map[pct]) {
      map[pct] = { gst_pct: pct, taxable_amount: 0, gst_amount: 0 };
    }
    map[pct].taxable_amount += parseFloat(item.taxable_amount) || 0;
    map[pct].gst_amount += parseFloat(item.gst_amount) || 0;
  }
  return Object.values(map).sort((a, b) => a.gst_pct - b.gst_pct);
}

/**
 * Generate item rows HTML.
 * NEVER includes purchase_price, cost_price_snapshot, profit_amount, profit_pct, or line_profit.
 */
function buildItemRows(items, hasAltQty) {
  return items
    .map(
      (item) => `
    <tr>
      <td>${item.sr_no}</td>
      <td class="left">${item.product_name || ''}</td>
      <td>${item.hsn_code || ''}</td>
      <td>${item.quantity}</td>
      ${hasAltQty ? `<td>${item.alt_qty || ''}</td>` : ''}
      <td>${item.unit || ''}</td>
      <td class="right">${formatCurrency(item.rate)}</td>
      <td>${parseFloat(item.discount_pct) || 0}%</td>
      <td>${parseFloat(item.gst_pct) || 0}%</td>
      <td class="right">${formatCurrency(item.total)}</td>
    </tr>`
    )
    .join('\n');
}

/**
 * Build GST summary rows HTML.
 */
function buildGstSummaryRows(items) {
  const summary = buildGstSummary(items);
  return summary
    .map((row) => {
      const halfGst = row.gst_amount / 2;
      return `
    <tr>
      <td>${row.gst_pct}%</td>
      <td>${formatCurrency(row.taxable_amount)}</td>
      <td>${formatCurrency(halfGst)}</td>
      <td>${formatCurrency(halfGst)}</td>
      <td>${formatCurrency(row.gst_amount)}</td>
    </tr>`;
    })
    .join('\n');
}

/**
 * Replace {{mustache}} placeholders with data values.
 */
function replacePlaceholders(html, data) {
  return html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (key in data) {
      return data[key];
    }
    return '';
  });
}

/**
 * Generate a PDF buffer for the given invoice data.
 * @param {object} invoiceData - invoice header + items array
 * @param {object} options - optional: { template: 'invoice-a4' | 'invoice-thermal' }
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateInvoicePDF(invoiceData, options = {}) {
  const templateName = options.template || 'invoice-a4';
  const templatePath = path.join(TEMPLATE_DIR, `${templateName}.html`);

  // Read the HTML template
  let html = fs.readFileSync(templatePath, 'utf-8');

  // Determine if any item has alt_qty
  const hasAltQty = !!(invoiceData.has_alt_qty || (invoiceData.items || []).some(i => i.alt_qty));

  // Build item rows and GST summary rows
  const itemRowsHtml = buildItemRows(invoiceData.items || [], hasAltQty);
  const gstSummaryRowsHtml = buildGstSummaryRows(invoiceData.items || []);

  // Replace items block
  html = html.replace(
    /\{\{#items\}\}[\s\S]*?\{\{\/items\}\}/,
    itemRowsHtml
  );

  // Replace GST summary block
  html = html.replace(
    /\{\{#gstSummary\}\}[\s\S]*?\{\{\/gstSummary\}\}/,
    gstSummaryRowsHtml
  );

  // Calculate CGST and SGST (half of total GST each for intra-state)
  const totalGst = parseFloat(invoiceData.total_gst) || 0;
  const cgstTotal = totalGst / 2;
  const sgstTotal = totalGst / 2;

  // Previous balance and total due
  const prevBalance = parseFloat(invoiceData.prev_balance) || 0;
  const grandTotalNum = parseFloat(invoiceData.grand_total) || 0;
  const amountPaidNum = parseFloat(invoiceData.amount_paid) || 0;
  const totalDue = prevBalance + grandTotalNum - amountPaidNum;

  // Process conditional flags (before placeholder replacement)
  html = processConditionalFlags(html, {
    SHOW_CUSTOMER_PHONE: !!(invoiceData.customer_phone),
    SHOW_CUSTOMER_GSTIN: !!(invoiceData.customer_gstin),
    SHOW_CUSTOMER_ADDRESS: !!(invoiceData.customer_address),
    SHOW_BALANCE_DUE: parseFloat(invoiceData.balance_due) > 0,
    SHOW_DISCOUNT_ROW: parseFloat(invoiceData.discount_total) > 0,
    SHOW_PREV_BALANCE: prevBalance > 0,
    SHOW_PAYMENT_INFO: amountPaidNum > 0,
    HAS_ALT_QTY: hasAltQty,
  });

  // Map bill_type to display string
  const billTypeMap = { retail: 'Retail', wholesale: 'Wholesale', quickbill: 'Quick Bill' };

  // Map DB column names to template placeholders
  const templateData = {
    storeName: invoiceData.store_name || 'UMA ENTERPRISES',
    storeAddress: invoiceData.store_address || '',
    storePhone: invoiceData.store_phone || '',
    storeGstin: invoiceData.store_gstin || '',
    invoiceNo: invoiceData.invoice_no || '',
    date: formatDate(invoiceData.invoice_date),
    billType: billTypeMap[invoiceData.bill_type] || invoiceData.bill_type || '',
    billTypeLabel: billTypeLabel(invoiceData.bill_type),
    customerName: invoiceData.customer_name || 'Walk-in Customer',
    customerPhone: invoiceData.customer_phone || '',
    customerGstin: invoiceData.customer_gstin || '',
    customerAddress: invoiceData.customer_address || '',
    customerBusiness: invoiceData.customer_business || '',
    subtotal: formatCurrency(invoiceData.subtotal),
    discountTotal: formatCurrency(invoiceData.discount_total),
    taxableTotal: formatCurrency(invoiceData.taxable_total),
    totalGst: formatCurrency(invoiceData.total_gst),
    cgstTotal: formatCurrency(cgstTotal),
    sgstTotal: formatCurrency(sgstTotal),
    grandTotal: formatCurrency(invoiceData.grand_total),
    grandTotalWords: numberToWords(invoiceData.grand_total),
    amountPaid: formatCurrency(invoiceData.amount_paid),
    balanceDue: formatCurrency(invoiceData.balance_due),
    prevBalance: formatCurrency(prevBalance),
    totalDue: formatCurrency(totalDue),
    paymentMode: invoiceData.payment_mode || '',
    paymentStatus: (invoiceData.status || 'unpaid').toUpperCase(),
    dueDate: formatDate(invoiceData.due_date),
  };

  html = replacePlaceholders(html, templateData);

  // Determine PDF options based on template
  const isThermal = templateName === 'invoice-thermal';

  // Launch Puppeteer and generate PDF
  const launchOptions = {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const browser = await puppeteer.launch(launchOptions);

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfOptions = isThermal
      ? {
          width: '80mm',
          printBackground: true,
          margin: { top: '2mm', right: '2mm', bottom: '2mm', left: '2mm' },
        }
      : {
          format: 'A4',
          printBackground: true,
          margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
        };

    const pdfBuffer = await page.pdf(pdfOptions);

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

module.exports = {
  generateInvoicePDF,
  numberToWords,
  formatCurrency,
  formatDate,
  billTypeLabel,
  processConditionalFlags,
};

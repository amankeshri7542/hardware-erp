# Backend Modules — Business Logic & Patterns

## Module Structure Convention

Every module in `backend/src/modules/{name}/`:
```
{name}.router.js       — Route definitions + middleware chain
{name}.controller.js   — req/res handling, calls service, sends JSON
{name}.service.js      — Business logic + all DB queries
{name}.validation.js   — express-validator schemas
```

**Rules:** Controllers never access the DB. Services never touch req/res.

---

## Auth Module

**Files:** `auth/auth.router.js`, `auth.controller.js`, `auth.service.js`

- **Login:** Validates email/password → bcrypt compare → returns JWT access token (8h) + httpOnly refresh cookie (30d)
- **Refresh:** Reads httpOnly cookie → verifies refresh token → issues new access token
- **Logout:** Clears refresh cookie
- Single role: `admin` — all authenticated users have full access

---

## Products Module

**Files:** `products/products.router.js`, `products.controller.js`, `products.service.js`, `products.search.service.js`, `products.validation.js`

### Key Service Functions
- `getAllProducts()` — Filtered list with pagination
- `getProductById()` — Single product lookup
- `createProduct()` — INSERT with 23505 duplicate handling (SKU/barcode)
- `updateProduct(id, data, userId)` — Dynamic UPDATE (only fields present in `data`). If `current_stock` changes: uses transaction, SELECT FOR UPDATE, creates stock_ledger adjustment entry
- `softDeleteProduct()` — Sets `is_active = false`
- `getProductStockLedger()` — Paginated ledger with date range
- `getProductPriceHistory()` — Price change history with user who changed
- `getProductSuppliers()` / `linkProductSupplier()` / `unlinkProductSupplier()` — Supplier links
- `getUnitConversions()` / `createUnitConversion()` / `deleteUnitConversion(conversionId)` — Alt units

### Search Service
- `searchByName(query, limit)` — pg_trgm similarity + ILIKE, max 8 results
- `searchByBarcode(code)` — Exact B-tree lookup, single result
- **Critical:** All search responses must include `gst_rate`, `purchase_price`, `hsn_code` — billing breaks without them

---

## Invoices Module

**Files:** `invoices/invoices.router.js`, `invoices.controller.js`, `invoices.service.js`, `invoices.validation.js`

### Invoice Creation — The Most Critical Transaction

`createInvoice(data, userId)` runs 10 steps in a single transaction:
1. Lock product rows with `SELECT ... FOR UPDATE`
2. Validate stock availability for all items
3. INSERT into `invoices` (trigger auto-generates invoice_no)
4. INSERT all `invoice_items` (with cost_price_snapshot frozen at billing time)
5. UPDATE `products.current_stock` (decrement by qty)
6. INSERT `stock_ledger` entries (movement_type = 'out')
7. INSERT `customer_ledger` debit (if not quickbill; trigger syncs outstanding)
8. INSERT `payments` + `payment_modes_detail` (if amount_paid > 0)
9. INSERT `customer_ledger` credit (if payment made)
10. COMMIT → queue PDF job (failure never rolls back invoice)

### Bill Types
| Type | Pricing | Customer Required |
|------|---------|------------------|
| retail | MRP | Yes |
| wholesale | Wholesale price | Yes (with GSTIN) |
| quickbill | MRP | No (optional walk-in name) |

### Line Item Calculation
```
discount_amount = rate * (discount_pct / 100)
taxable_amount  = (rate - discount_amount) * qty
gst_amount      = taxable_amount * (gst_pct / 100)
line_total      = taxable_amount + gst_amount
line_profit     = (rate - discount_amount - cost_price_snapshot) * qty
```

### Returns
`processReturn(invoiceId, items, userId)` — Single transaction:
1. Validate return quantities against original
2. INSERT return invoice items
3. UPDATE products.current_stock (increment)
4. INSERT stock_ledger (movement_type = 'return_in')
5. Adjust customer_ledger and invoice balance

### Other Functions
- `listInvoices()` — Paginated list with summary (total_sales, total_gst, total_profit)
- `getInvoiceDetail(id)` — Full invoice + items + payments + customer info (flat fields, not nested)
- `getPdfStatus()` / `getPdf()` / `regeneratePdf()` — PDF lifecycle

---

## Payments Module

**Files:** `payments/payments.router.js`, `payments.controller.js`, `payments.service.js`, `payments.validation.js`

- `recordPayment(data, userId)` — Transaction: INSERT payment → INSERT modes_detail (if mixed) → UPDATE invoice amounts → INSERT customer_ledger credit → trigger syncs outstanding
- `listPayments()` — Paginated list with customer/invoice info
- `getInvoicePayments()` — All payments for a specific invoice

---

## Purchases Module

**Files:** `purchases/purchases.router.js`, `purchases.controller.js`, `purchases.service.js`, `purchases.validation.js`

- `createPurchase(data, userId)` — Transaction: INSERT purchase + items → UPDATE products.current_stock (increment) → INSERT stock_ledger (movement_type = 'in') → UPDATE products.purchase_price
- `listPurchases()` — Paginated with supplier info
- `getPurchaseDetail(id)` — Purchase + items + supplier
- `createPurchaseReturn(purchaseId, data, userId)` — Transaction: INSERT return + items → UPDATE stock (decrement) → INSERT stock_ledger (return_out) → CREATE debit note

---

## Customers Module

**Files:** `customers/customers.router.js`, `customers.controller.js`, `customers.service.js`, `customers.validation.js`

- `search(query)` — Name/phone prefix search
- `list()` — Paginated with filters (type, isActive)
- `create(data)` — INSERT with 23505 duplicate phone handling
- `getById(id)` — Full customer
- `update(id, data)` — Dynamic partial update
- `deactivate(id)` — Soft delete
- `getLedger(customerId, filters)` — Paginated ledger entries
- `getSummary(customerId)` — Outstanding, total purchases, payment history

---

## Suppliers Module

**Files:** `suppliers/suppliers.router.js` (shared with purchases controller)

- `createSupplier()`, `listSuppliers()`, `getSupplier()`, `updateSupplier()`
- `getSupplierProducts()` — Products linked via product_suppliers table
- `getSupplierDebitNotes()` — Outstanding debit notes

---

## Reports Module

**Files:** `reports/reports.router.js`, `reports.controller.js`, `reports.service.js`, `exports.service.js`, `exports.router.js`, `exports.controller.js`

### Data Reports (reports.service.js)
All return raw snake_case DB column names (no camelCase mapping).

| Function | Key Return Shape |
|----------|-----------------|
| `getSalesReport()` | `{ invoices[], summary, total, page, totalPages }` |
| `getGstReport()` | `{ invoices[], rate_summary[] }` |
| `getStockReport()` | `{ products[], summary }` |
| `getStockMovementReport()` | `{ movements[], summary, pagination }` |
| `getCustomerDuesReport()` | `{ customers[], pagination }` |
| `getProfitReport()` | `{ invoices[], summary, pagination }` |
| `getPaymentCollectionsReport()` | `{ payments[], summary, pagination }` |
| `getProductCategories()` | String array |

### Excel Exports (exports.service.js)
Server-side ExcelJS workbook generation. Streamed as `Content-Disposition: attachment`.
- Frozen header row (blue background)
- Auto-width columns
- `₹#,##0.00` for money, `DD-MM-YYYY` for dates
- Bold total/summary rows
- Full export creates multi-sheet workbook (Customers, Products, Invoices, Items, Payments, Ledger)

---

## Dashboard Module

**Files:** `dashboard/dashboard.router.js`, `dashboard.controller.js`, `dashboard.service.js`

- `getSummary()` — Today's sales, month sales, total customers, low stock count
- `salesOverview()` — Daily sales chart data (last 30 days)
- `overdueInvoices()` — Unpaid/partial invoices
- `overdueCustomers()` — Customers with outstanding > 0
- `recentActivity()` — Latest invoices + payments
- `paymentModeBreakdown()` — Cash/UPI/bank/cheque split for current month

---

## Settings Module

**Files:** `settings/settings.router.js`, `settings.controller.js`, `settings.service.js`

- `getSettings()` — Returns all key-value pairs from settings table
- Default keys: store_name, store_address, store_phone, store_gstin, invoice prefixes, payment_terms_default, low_stock_alert_enabled, supervisor_pin

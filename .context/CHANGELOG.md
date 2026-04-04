# Changelog

## Phase 1 — Foundation (March 2026)

### Database
- PostgreSQL 15 schema: users, customers, products, invoices, invoice_items, payments, payment_modes_detail, stock_ledger, customer_ledger, purchases, purchase_items
- pg_trgm extension for fuzzy search
- Triggers: auto invoice numbering, negative stock prevention, append-only ledgers, customer outstanding sync
- Sequences: retail, wholesale, quickbill invoice numbering
- Seed data: admin user, 10 suppliers, 18 customers, 55+ products (Bihar hardware items)

### Backend
- Express API with module pattern (router → controller → service → DB)
- JWT authentication with refresh token flow
- Product CRUD with fuzzy name search + barcode lookup
- Customer CRUD with phone validation + ledger
- Invoice creation (10-step atomic transaction)
- Payment recording (single + mixed mode)
- Purchase orders with stock-in
- PDF generation with Puppeteer + BullMQ queue
- S3 upload with pre-signed URL downloads

### Frontend
- React 18 + Ant Design 5 + Vite
- Billing page with keyboard-first UX (F2, F4, F9, Esc shortcuts)
- Product search with 150ms debounce
- Customer search with phone prefix matching
- Dashboard with summary stats
- Invoice list + detail pages
- Customer list + detail + ledger
- Product list + detail + stock ledger

### Infrastructure
- EC2 t2.micro (Ubuntu 22.04) in ap-south-1
- RDS PostgreSQL 15
- S3 bucket (uma-erp-storage)
- nginx reverse proxy
- PM2 process management

## Phase 2 — Reports & Exports (March 2026)

- 7 report types: Sales, GST, Stock, Stock Movement, Customer Dues, Profit, Collections
- Server-side Excel exports using ExcelJS (streamed, not saved to disk)
- Full data export (multi-sheet workbook)
- Report pages with date range filters, summary cards, data tables
- Export buttons on all report pages

## Phase 3 — Purchase Management (March-April 2026)

- Purchase returns with qty tracking
- Supplier debit notes (auto-generated)
- Purchase return numbering (PR-YYYY-NNNNN sequence)
- Stock restoration on purchase returns (return_out movement)
- Supplier detail page with linked products + debit notes

## Phase 4 — Product Enhancements (April 2026)

- Unit conversions (alt units with conversion values)
- Product price history tracking
- Product-supplier linking (multi-supplier per product)
- Base unit support for products
- Settings table (store config, invoice prefixes)
- Migration 003: Settings table
- Migration 004: Unit conversions, price history, product suppliers
- Migration 005: Purchase returns, debit notes
- Migration 006: Invoice items alt_qty/alt_unit/base_qty
- Migration 007: Missing sequences for purchase returns

## Phase 5 — Sales Returns (April 2026)

- Invoice return processing (partial/full)
- Stock restoration on sales returns (return_in movement)
- Customer ledger adjustment on returns
- Invoice balance recalculation after return

## Phase 6 — Bug Fixes & Audit (April 2026)

### Codebase Audit (April 5, 2026)
Comprehensive audit of all frontend pages and backend services.

**Frontend Fixes:**
- InvoiceDetailPage: 12+ field name mismatches fixed (₹NaN values)
  - `payment_status` → `status`
  - `total_taxable` → `taxable_total`
  - `total_gst` → `gst_total`
  - `total_discount` → `discount_total`
  - `taxable` → `taxable_amount`, `net_amount` → `line_total`
  - Customer section: nested `customer.name` → flat `customer_name`
- InvoicesPage: `payment_status` → `status`, `total_profit` → `profit_amount`
- All 7 report pages: systematic camelCase → snake_case alignment
  - SalesReportPage: invoice_date→date, payment_status→status, total_tax→total_gst
  - GstReportPage: gst_rate→gst_pct, cgst_amount→cgst, sgst_amount→sgst
  - StockReportPage: reorder_level→min_stock, stock_value→stock_value_cost
  - CustomerDuesPage: customer_name→name, customer_id→id, customer_type→type
  - ProfitReportPage: total_sales→total_revenue, total_cost→total_cogs
  - CollectionsReportPage: payment_mode→mode, total_amount→total_collected
  - StockMovementPage: verified correct (already matched)

**Backend Fixes:**
- reports.service.js: Removed all camelCase mapping — returns raw DB columns
- reports.controller.js: Fixed `billType`→`bill_type`, `customerId`→`customer_id` param names
- exports.service.js: Updated data key references to match new return shapes
- invoices.service.js: Added profit_amount to listInvoices, added summary query
- invoices.controller.js: Added summary to list response
- products.service.js: Fixed deleteUnitConversion (removed extra productId param)
- products.service.js: Wrapped stock adjustment in transaction (BEGIN/COMMIT/ROLLBACK)

**Removed:**
- Frequent products/quick pick feature (unused code in search service + frontend)

## Documentation Overhaul (April 5, 2026)

- Restructured CLAUDE.md to concise orientation document
- Created `.context/` folder with 9 detailed reference documents
- ARCHITECTURE.md, DATABASE.md, API.md, MODULES.md, FRONTEND.md
- SECURITY.md, KNOWN_ISSUES.md, CHANGELOG.md, QUICKSTART.md

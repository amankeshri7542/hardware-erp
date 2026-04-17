# Quick Start — Dev Onboarding

> Last updated: 2026-04-17. Get up and running in 10 minutes.

## What Is This?

UMA Enterprises ERP — billing + inventory management for a hardware shop in Bihar, India. Single-location, 2-3 users, ~100-150 invoices/day. Handles retail/wholesale billing, stock tracking, customer ledgers (khata), payments, PDF invoices, GST reports, Excel exports, purchase management, sales returns, and unit conversions.

## Prerequisites

- **Node.js 18+** (LTS)
- **PostgreSQL 15** (local or Docker)
- **Redis** (optional — PDF queue falls back to sync without it)
- **Google Chrome or Chromium** (for Puppeteer PDF generation)

## 1. Clone & Install

```bash
git clone <repo-url>
cd hardware-erp

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

## 2. Database Setup

```bash
# Create database
createdb hardware_erp

# Enable fuzzy search extension
psql hardware_erp -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"

# Run all 9 migrations IN ORDER
for i in $(seq -w 1 9); do
  psql hardware_erp < ../db/migrations/0${i#0}*.sql
done

# Or manually:
psql hardware_erp < ../db/migrations/001_initial_schema.sql
psql hardware_erp < ../db/migrations/002_triggers_and_functions.sql
# ... through 009_invoice_items_qty_returned.sql

# Seed data (admin user + test products/customers/invoices)
psql hardware_erp < ../db/seeds/001_admin_user.sql
psql hardware_erp < ../db/seeds/002_test_data.sql
psql hardware_erp < ../db/seeds/003_test_invoices.sql
```

## 3. Backend Environment

Create `backend/.env.local`:
```env
PORT=4000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hardware_erp
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=dev-secret-change-me
JWT_REFRESH_SECRET=dev-refresh-secret-change-me
CORS_ORIGIN=http://localhost:5173
STORE_NAME=UMA Enterprises
STORE_ADDRESS=Bihar, India
STORE_PHONE=9876543210
STORE_GSTIN=10XXXXX1234X1ZX
```

## 4. Start Development

```bash
# Terminal 1 — Backend (port 4000)
cd hardware-erp/backend
npm run dev   # or: node server.js

# Terminal 2 — Frontend (port 5173)
cd hardware-erp/frontend
npm run dev
```

Open `http://localhost:5173`. Login: `admin@store.local` / `Aman@9431`

## 5. Key Files to Read First

| File | Why |
|------|-----|
| `backend/src/modules/invoices/invoices.service.js` | **Most critical** — 10-step atomic transaction, returns, PDF |
| `frontend/src/pages/Billing/BillingPage.jsx` | **Most complex UI** — keyboard-first billing interface |
| `frontend/src/utils/billing.calculations.js` | Must match backend invoice calculations exactly |
| `backend/src/modules/products/products.service.js` | Product CRUD, search, stock management |
| `backend/src/modules/products/products.search.service.js` | Fuzzy search + barcode lookup |
| `frontend/src/hooks/useBilling.js` | Billing state management hook |
| `backend/src/app.js` | Express setup, middleware chain, route mounting |
| `frontend/src/App.jsx` | All 28 routes |

## 6. Project Structure

```
hardware-erp/
├── backend/src/
│   ├── app.js                          # Express setup, Helmet, CORS, routes
│   ├── config/                         # db.js, aws.js, redis.js
│   ├── middleware/                     # JWT auth, error handler, validation
│   ├── modules/                        # One folder per domain (11 modules)
│   │   ├── invoices/invoices.service.js  # ★ Most critical file
│   │   └── ...
│   ├── workers/pdfWorker.js            # BullMQ PDF consumer
│   ├── templates/                      # invoice-a4.html, invoice-thermal.html
│   └── utils/                          # s3.js, pdf.js, asyncHandler.js
├── frontend/src/
│   ├── App.jsx                         # All routes (28)
│   ├── pages/                          # Billing, Invoices, Customers, Products, etc.
│   ├── hooks/                          # useBilling, useProductSearch, useKeyboardBilling
│   ├── store/                          # authStore (Zustand), billingStore
│   ├── api/                            # One file per module (axios-based)
│   ├── components/                     # AppLayout, ProductSearch, CustomerSearch, etc.
│   └── utils/                          # billing.calculations.js, formatCurrency.js
├── db/migrations/                      # 001-009, run in order
├── db/seeds/                           # Admin user, test data
├── .context/                           # This documentation (9 files)
└── deploy/                             # deploy.sh, nginx.conf
```

### Module Pattern (every backend module)
```
modules/{name}/
├── {name}.router.js        # Routes + middleware
├── {name}.controller.js    # req/res only — no DB, no business logic
├── {name}.service.js       # All business logic + DB queries
└── {name}.validation.js    # express-validator schemas
```

## 7. Key Concepts

### Invoice Creation
The most critical operation — 10 steps in one DB transaction. Lock products → validate stock → insert invoice/items → update stock → ledger entries → payment. If any step fails, everything rolls back. See `MODULES.md`.

### Billing Calculations
Math runs both client-side (`billing.calculations.js`) and server-side (`invoices.service.js`). They must produce identical results. Change one → change the other.

### Unit Conversions
Products have base unit (piece, kg) + optional alt units (box, bag). `1 box = 12 pieces`. Stock always stored in base units. Billing resolves `base_qty = alt_qty × conversion_value`.

### Append-Only Ledgers
`stock_ledger` and `customer_ledger` cannot be UPDATEd or DELETEd — DB triggers enforce this. Every stock change creates a ledger entry.

### Sales Returns
Creates credit note (invoice with negative grand_total). `qty_returned` on original items prevents duplicate returns.

## 8. Common Tasks

### Add a new API endpoint
1. Route in `modules/{name}/{name}.router.js`
2. Handler in `{name}.controller.js` (req/res only)
3. Logic in `{name}.service.js` (DB queries)
4. Validation in `{name}.validation.js` (if POST/PUT)

### Add a new frontend page
1. Create `pages/{Section}/{Name}Page.jsx`
2. Add route in `App.jsx` (inside PrivateRoute wrapper)
3. Add sidebar item in `components/AppLayout.jsx`
4. API functions in `api/{name}.api.js`
5. Use Ant Design 5 components only

### Test billing flow
1. Go to `/billing` → search customer → select
2. Search product → select → adjust qty/rate/discount
3. Set payment amount and mode
4. Press F9 to submit
5. Verify: invoice created, stock decremented, ledger entries, PDF queued

## 9. Production Deployment

```bash
# 1. Build frontend on Mac (EC2 can't build — t2.micro OOM)
cd hardware-erp/frontend && npm run build

# 2. Upload build to EC2
scp -i hardware-erp-key-ec2.pem -r dist/* ubuntu@13.204.240.166:~/frontend-dist/

# 3. SSH and deploy
ssh -i hardware-erp-key-ec2.pem ubuntu@13.204.240.166
cd ~/hardware-ERP && git pull origin main
cd backend && npm install
sudo rm -rf /var/www/hardware-erp/frontend/dist/*
sudo cp -r ~/frontend-dist/* /var/www/hardware-erp/frontend/dist/
sudo chown -R www-data:www-data /var/www/hardware-erp/frontend/dist
sudo nginx -s reload
pm2 restart all --update-env
```

## 10. Where to Find Things

| I need to... | Look at... |
|-------------|-----------|
| Understand the DB schema | `DATABASE.md` |
| See all API endpoints | `API.md` |
| Understand billing logic | `MODULES.md` → Invoices Module |
| See frontend routes/hooks | `FRONTEND.md` |
| Check security concerns | `SECURITY.md` |
| See what's broken/TODO | `KNOWN_ISSUES.md` |
| See change history | `CHANGELOG.md` |
| Understand system design | `ARCHITECTURE.md` |

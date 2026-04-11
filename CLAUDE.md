# CLAUDE.md — UMA Enterprises ERP

## Quick Orientation

**Project:** Hardware & Building Materials ERP for a single-location shop in Bihar, India
**Stack:** Node.js + Express | React 18 + Ant Design 5 | PostgreSQL 15 (AWS RDS)
**Live:** `http://13.204.240.166` — Login: `admin@store.local` / `Aman@9431`
**Scale:** ~100-150 invoices/day, 2-3 users, single admin role
**Last deployed:** 2026-04-11 | **Git:** `main` branch on `amankeshri7542/hardware-ERP`

Handles: retail/wholesale billing, inventory, customer ledgers (khata), payments, PDF invoices, GST reports, Excel exports, purchase invoice uploads, sales returns.

## Local Dev Setup

```bash
# Backend (reads .env.local → local PostgreSQL uma_erp)
cd hardware-erp/backend && npm run dev   # port 4000

# Frontend (reads .env.local → proxy to localhost:4000)
cd hardware-erp/frontend && npm run dev  # port 5173
```

**Key env files (all gitignored):**
- `backend/.env` — production (AWS RDS, S3, JWT secrets)
- `backend/.env.local` — local dev (localhost PostgreSQL, simple JWT secrets)
- `frontend/.env` — production API URL (`http://13.204.240.166/api`)
- `frontend/.env.local` — local dev (`VITE_API_URL=` → Vite proxy)

**Deploy to EC2:**
```bash
# 1. Build + upload frontend
cd hardware-erp/frontend && npm run build
scp -i hardware-erp-key-ec2.pem -r dist/ ubuntu@13.204.240.166:~/frontend-dist

# 2. SSH and deploy
ssh -i hardware-erp-key-ec2.pem ubuntu@13.204.240.166
cd ~/hardware-ERP && git pull origin main
cd backend && npm install
sudo rm -rf /var/www/hardware-erp/frontend/dist/* && sudo cp -r ~/frontend-dist/* /var/www/hardware-erp/frontend/dist/
sudo chown -R www-data:www-data /var/www/hardware-erp/frontend/dist
sudo nginx -s reload
pm2 restart all --update-env
```

## Detailed Documentation

All detailed docs live in `hardware-erp/.context/`:

| File | Contents |
|------|----------|
| [ARCHITECTURE.md](.context/ARCHITECTURE.md) | System design, infra, data flows, PDF pipeline |
| [DATABASE.md](.context/DATABASE.md) | All tables, columns, constraints, triggers, indexes |
| [API.md](.context/API.md) | Every endpoint by module with params & responses |
| [MODULES.md](.context/MODULES.md) | Backend service functions, business logic, patterns |
| [FRONTEND.md](.context/FRONTEND.md) | Routes, hooks, keyboard shortcuts, billing flow |
| [SECURITY.md](.context/SECURITY.md) | Auth, CORS, JWT, S3, known gaps |
| [KNOWN_ISSUES.md](.context/KNOWN_ISSUES.md) | Bugs, TODOs, technical debt |
| [CHANGELOG.md](.context/CHANGELOG.md) | All phases and changes |
| [QUICKSTART.md](.context/QUICKSTART.md) | 10-minute dev onboarding guide |

## Repository Layout

```
hardware-erp/
├── backend/src/
│   ├── app.js                    # Express setup
│   ├── config/                   # db.js, aws.js, redis.js
│   ├── middleware/               # JWT auth, error handler, validation
│   ├── modules/                  # One folder per domain (see below)
│   ├── workers/pdfWorker.js      # BullMQ PDF consumer
│   ├── templates/                # invoice-a4.html, invoice-thermal.html
│   └── utils/                    # s3.js, pdf.js, asyncHandler.js
├── frontend/src/
│   ├── App.jsx                   # All routes
│   ├── pages/                    # Billing, Invoices, Customers, Products, etc.
│   ├── hooks/                    # useBilling.js, useProductSearch.js
│   ├── store/authStore.js        # Zustand auth state
│   ├── api/                      # One file per module (axios-based)
│   └── utils/                    # billing.calculations.js, formatCurrency.js
├── db/migrations/                # 001-007, run in order
├── db/seeds/                     # Admin user, test data
├── .context/                     # Detailed documentation (9 files)
└── deploy/                       # deploy.sh, nginx.conf
```

### Module Pattern (every backend module)
```
modules/{name}/
├── {name}.router.js        # Routes only
├── {name}.controller.js    # req/res only — no DB, no business logic
├── {name}.service.js       # All business logic + DB queries
└── {name}.validation.js    # express-validator schemas
```

**Modules:** auth, products, customers, invoices, payments, purchases, suppliers, reports, dashboard, settings

## Local Development

```bash
# Backend
cd hardware-erp/backend
cp .env.example .env    # edit DB credentials
npm install && node server.js

# Frontend
cd hardware-erp/frontend
npm install && npm run dev
```

Open `http://localhost:5173`. See `.context/QUICKSTART.md` for full setup including DB migrations.

## Production Deployment

```bash
# 1. Build frontend on Mac (t2.micro can't build)
cd hardware-erp/frontend && npm run build

# 2. Upload to EC2 home dir
scp -i key.pem -r dist/ ubuntu@13.204.240.166:~/frontend-dist

# 3. SSH and deploy
ssh -i key.pem ubuntu@13.204.240.166
cd /home/ubuntu/hardware-erp && git pull origin main
cd backend && npm install
sudo cp -r ~/frontend-dist/* /var/www/hardware-erp/frontend/dist/
sudo chown -R www-data:www-data /var/www/hardware-erp/frontend/dist
pm2 restart all
```

**Infra:** EC2 t2.micro (ap-south-1) | RDS PostgreSQL 15 | S3 `uma-erp-storage` | nginx | PM2

## 5 Absolute Rules — Never Break These

### 1. Invoice creation is ONE atomic transaction
All 10 steps (lock products → insert invoice → insert items → update stock → ledger entries → payment) run inside a single `BEGIN...COMMIT`. If any step fails → `ROLLBACK` everything. No partial saves. Ever. See `.context/MODULES.md` for the full sequence.

### 2. Ledgers are append-only
`stock_ledger` and `customer_ledger` cannot be UPDATED or DELETED — DB triggers enforce this. Every stock change creates a ledger entry. `customers.outstanding_balance` is auto-synced by trigger after each ledger INSERT.

### 3. Cost snapshots are immutable
`invoice_items.cost_price_snapshot` is frozen at billing time. Never recalculate old invoice profit from current `purchase_price`. Never expose `purchase_price`, `cost_price_snapshot`, `profit_amount`, `profit_pct`, or `line_profit` on customer-facing PDFs.

### 4. Billing calculations must match client and server
`frontend/src/utils/billing.calculations.js` and `backend/src/modules/invoices/invoices.service.js` both compute line items and totals. They must produce identical results. Change one → change the other.

### 5. Product search must return all billing fields
Every product search/lookup must include: `id, name, sku, barcode, unit, mrp, wholesale_price, purchase_price, current_stock, gst_rate, hsn_code`. Missing `gst_rate` → GST calculated as 0%. Missing `purchase_price` → profit calculated as 100%.

## Coding Standards (Quick Reference)

- **No `SELECT *`** — always list columns
- **No raw SQL interpolation** — always `$1, $2` parameterized queries
- **No business logic in controllers** — service layer only
- **No client-side Excel** — server-side ExcelJS only
- **Soft deletes only** — `is_active = false`, never hard-delete customers/products
- **NUMERIC(12,2)** for money in DB — never floating point
- **Ant Design 5 only** — no Tailwind, shadcn, Material UI
- **snake_case in DB/API** — frontend uses DB column names as-is
- **VITE_API_URL** — set to real URL or omit entirely (empty string is truthy in JS)
- **Don't build on EC2** — t2.micro can't handle Vite builds

## Key Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| INSUFFICIENT_STOCK | 422 | Stock check failed |
| DUPLICATE_SKU/BARCODE/PHONE | 409 | Unique constraint violation |
| INVOICE/PRODUCT/CUSTOMER_NOT_FOUND | 404 | Not found |
| PDF_NOT_READY | 202 | PDF still generating |

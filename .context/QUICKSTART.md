# Quickstart — 10-Minute Onboarding

## What Is This?

UMA Enterprises ERP — a billing + inventory management system for a hardware shop in Bihar, India. Single-location, 2-3 users, ~100-150 invoices/day. Handles retail/wholesale billing, stock tracking, customer ledgers (khata), payments, PDF invoices, GST reports, and Excel exports.

## Prerequisites

- Node.js 18+
- PostgreSQL 15 (local or RDS)
- Redis (optional — only for async PDF queue)
- Chromium/Chrome (for Puppeteer PDF generation)

## Local Setup

### 1. Clone & Install

```bash
git clone <repo-url>
cd hardware-erp

# Backend
cd backend
cp .env.example .env
# Edit .env with your local DB credentials
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Database Setup

```bash
# Create database
createdb hardware_erp

# Run migrations in order
psql hardware_erp < db/migrations/001_initial_schema.sql
psql hardware_erp < db/migrations/002_triggers_and_functions.sql
psql hardware_erp < db/migrations/003_settings.sql
psql hardware_erp < db/migrations/004_unit_conversions_and_price_history.sql
psql hardware_erp < db/migrations/005_purchase_returns_and_debit_notes.sql
psql hardware_erp < db/migrations/006_invoice_items_alt_qty.sql
psql hardware_erp < db/migrations/007_missing_sequences.sql

# Seed test data
psql hardware_erp < db/seeds/001_admin_user.sql
psql hardware_erp < db/seeds/002_test_data.sql
psql hardware_erp < db/seeds/003_test_invoices.sql
```

### 3. Backend .env (minimum)

```env
NODE_ENV=development
PORT=4000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hardware_erp
DB_USER=postgres
DB_PASSWORD=yourpassword
JWT_SECRET=any-random-string
JWT_REFRESH_SECRET=another-random-string
CORS_ORIGIN=http://localhost:5173
STORE_NAME=UMA Enterprises
```

### 4. Start Development

```bash
# Terminal 1: Backend
cd backend
node server.js

# Terminal 2: Frontend
cd frontend
npm run dev
```

Open `http://localhost:5173`. Login: `admin@store.local` / `Aman@9431`

## Project Structure (Key Files)

```
hardware-erp/
├── backend/src/
│   ├── app.js                          # Express setup, all middleware
│   ├── config/db.js                    # PostgreSQL pool
│   ├── middleware/authenticateJWT.js    # JWT verification
│   ├── modules/                        # One folder per domain
│   │   ├── invoices/invoices.service.js  # ★ Most critical file
│   │   ├── products/products.service.js
│   │   ├── payments/payments.service.js
│   │   └── ...
│   └── templates/invoice-a4.html       # PDF template
├── frontend/src/
│   ├── App.jsx                         # All routes
│   ├── pages/Billing/BillingPage.jsx   # ★ Most complex page
│   ├── hooks/useBilling.js             # Billing state + logic
│   ├── utils/billing.calculations.js   # GST/total math
│   └── api/axios.js                    # HTTP client config
├── db/migrations/                      # Schema (run in order)
└── .context/                           # This documentation
```

## Key Concepts

### Module Pattern
Every backend module: `router.js` → `controller.js` → `service.js` → PostgreSQL. Controllers handle req/res. Services handle business logic + queries.

### Invoice Creation
The most critical operation — 10 steps in one DB transaction. See `.context/MODULES.md` for details. If any step fails, everything rolls back.

### Billing Calculations
Math runs both client-side (`billing.calculations.js`) and server-side (`invoices.service.js`). They must stay in sync.

### Stock Tracking
Every stock change creates an append-only `stock_ledger` entry. The ledger cannot be updated or deleted (DB trigger enforced).

### Customer Ledger (Khata)
Every invoice creates a debit entry, every payment creates a credit entry. `customers.outstanding_balance` is auto-calculated by a DB trigger.

## Common Tasks

### Add a new API endpoint
1. Add route in `modules/{name}/{name}.router.js`
2. Add handler in `{name}.controller.js` (req/res only)
3. Add logic in `{name}.service.js` (DB queries)
4. Add validation in `{name}.validation.js` (if POST/PUT)

### Add a new frontend page
1. Create page in `src/pages/{Section}/NewPage.jsx`
2. Add route in `App.jsx`
3. Add API function in `src/api/{module}.api.js`
4. Use Ant Design components only

### Add a new DB table
1. Create migration file `db/migrations/NNN_description.sql`
2. Run migration on local DB
3. Run migration on production RDS

## Deployment (Mac → EC2)

```bash
# 1. Build frontend locally
cd frontend && npm run build

# 2. Upload to EC2
scp -i key.pem -r dist/ ubuntu@13.204.240.166:~/frontend-dist

# 3. SSH + deploy
ssh -i key.pem ubuntu@13.204.240.166
cd /home/ubuntu/hardware-erp && git pull origin main
cd backend && npm install
sudo cp -r ~/frontend-dist/* /var/www/hardware-erp/frontend/dist/
sudo chown -R www-data:www-data /var/www/hardware-erp/frontend/dist
pm2 restart all
```

## Where to Find Things

| I need to... | Look at... |
|-------------|-----------|
| Understand the DB schema | `.context/DATABASE.md` |
| See all API endpoints | `.context/API.md` |
| Understand billing logic | `.context/MODULES.md` → Invoices Module |
| See frontend routes/hooks | `.context/FRONTEND.md` |
| Check security concerns | `.context/SECURITY.md` |
| See what's broken/TODO | `.context/KNOWN_ISSUES.md` |
| See change history | `.context/CHANGELOG.md` |
| Understand system architecture | `.context/ARCHITECTURE.md` |

## Rules (Don't Break These)

1. **No `SELECT *`** — always list columns
2. **No raw SQL interpolation** — always `$1, $2` params
3. **No business logic in controllers** — service layer only
4. **Append-only ledgers** — never UPDATE/DELETE stock_ledger or customer_ledger
5. **Cost snapshots are immutable** — never recalculate old invoice profit from current prices

# Architecture

## System Overview

UMA Enterprises ERP — single-location hardware shop management system for a medium-level store in Bihar, India. Handles retail & wholesale billing, inventory, customer ledgers, payments, PDF invoices, GST reports, and Excel exports. Designed for ~100-150 invoices/day, 2-3 concurrent users.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js 18 + Express 4 |
| **Frontend** | React 18 + Ant Design 5 + Vite |
| **Database** | PostgreSQL 15 (AWS RDS) |
| **PDF Generation** | Puppeteer + BullMQ (Redis queue) |
| **File Storage** | AWS S3 (`uma-erp-storage` bucket) |
| **Process Manager** | PM2 (api + pdf-worker processes) |
| **Web Server** | nginx (reverse proxy + static files) |
| **State Management** | Zustand (auth only) |
| **Excel Exports** | ExcelJS (server-side streaming) |

## Infrastructure

```
[Browser] → [nginx :80]
               ├─ /       → /var/www/hardware-erp/frontend/dist/ (React SPA)
               └─ /api/*  → proxy_pass http://127.0.0.1:4000 (Express)
                               ├─ erp-api (PM2, port 4000)
                               └─ erp-pdf-worker (PM2, BullMQ consumer)

[Express] → [PostgreSQL RDS] (ap-south-1)
          → [S3 uma-erp-storage] (PDF invoices)
          → [Redis] (BullMQ PDF queue, optional)
```

**Server:** EC2 t2.micro, Ubuntu 22.04, ap-south-1 (Mumbai)
**IP:** 13.204.240.166
**RDS Host:** hardware-erp-db.cf8m0m4624nq.ap-south-1.rds.amazonaws.com

## Backend Architecture

### Module Pattern

Every module follows this convention:

```
backend/src/modules/{name}/
├── {name}.router.js        # Route definitions only
├── {name}.controller.js    # Request/response handling — no business logic
├── {name}.service.js       # All business logic + DB queries
└── {name}.validation.js    # express-validator schemas
```

**Rule:** Controllers never touch the database. Services never touch `req`/`res`.

### Modules

| Module | Responsibility |
|--------|---------------|
| `auth` | Login, logout, JWT refresh |
| `products` | CRUD, fuzzy search (pg_trgm), barcode lookup, stock ledger, price history, unit conversions, supplier links |
| `customers` | CRUD, phone search, ledger, outstanding summary |
| `invoices` | Billing (create invoice), returns, PDF generation, status tracking |
| `payments` | Record payments (single/mixed mode), link to invoices |
| `purchases` | Purchase orders, stock-in, purchase returns, debit notes |
| `suppliers` | Supplier CRUD, linked products, debit notes |
| `reports` | 8 report types (data queries) + Excel exports |
| `dashboard` | Summary stats, overdue invoices, sales overview |
| `settings` | Store configuration (key-value) |

### Request Flow

```
Request → nginx → Express middleware chain:
  1. CORS
  2. JSON body parser
  3. Rate limiter (express-rate-limit)
  4. authenticateJWT (except /auth/login, /health)
  5. Router → Controller → Service → PostgreSQL
  6. Response or errorHandler middleware
```

### Transaction Pattern

Critical operations use PostgreSQL transactions:

```js
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // ... multiple queries via client.query()
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```

Used in: invoice creation, payment recording, purchase stock-in, returns, stock adjustments.

### PDF Pipeline

**Primary (async):** Invoice created → BullMQ job queued → Worker picks up → Puppeteer renders HTML template → Upload to S3 → Update `pdf_status = 'ready'`

**Fallback (sync):** If Redis unavailable, `generatePdfDirect()` runs in the API process using local file storage (`local://path` prefix).

**Download:** S3 PDFs → 302 redirect to pre-signed URL (1hr). Local PDFs → `sendFile()` stream.

## Frontend Architecture

### Stack
- **React 18** with functional components + hooks
- **Ant Design 5** — the only UI library (no Tailwind, Material, shadcn)
- **React Router 6** — client-side routing with SPA fallback via nginx
- **Zustand** — auth state only (token + user in memory)
- **Vite** — build tool (cannot build on t2.micro, must build locally)

### State Strategy
- **Global (Zustand):** Auth token, user info — in-memory only
- **Local (useState/useReducer):** All page-level state — billing, search, modals
- **Custom hooks:** `useBilling` (billing form state + calculations), `useProductSearch` (debounced search)

### API Layer
Single axios instance (`api/axios.js`):
- `baseURL: import.meta.env.VITE_API_URL || '/api'`
- Request interceptor: attaches Bearer token
- Response interceptor: 401 → logout + redirect to `/login`
- `withCredentials: true` for httpOnly refresh cookie

### Key Pages
| Route | Page | Purpose |
|-------|------|---------|
| `/dashboard` | DashboardPage | Summary stats, charts, alerts |
| `/billing` | BillingPage | Invoice creation (keyboard-first) |
| `/invoices` | InvoicesPage | Invoice list + filters |
| `/invoices/:id` | InvoiceDetailPage | Full invoice view + PDF |
| `/customers` | CustomersPage | Customer list + CRUD |
| `/customers/:id` | CustomerDetailPage | Ledger, outstanding, invoices |
| `/products` | ProductsPage | Product list + CRUD |
| `/products/:id` | ProductDetailPage | Stock ledger, price history |
| `/purchases` | PurchasesPage | Purchase order list |
| `/purchases/new` | NewPurchasePage | Create purchase + stock-in |
| `/reports/*` | 7 report pages | Sales, GST, stock, profit, etc. |

## Data Flow: Invoice Creation

This is the most critical flow in the system:

```
1. BillingPage (frontend)
   └─ useBilling hook manages items, customer, payment
   └─ billing.calculations.js computes totals (client-side)
   └─ submitInvoice() → POST /api/invoices

2. invoices.controller.createInvoice
   └─ Validates request body
   └─ Calls invoices.service.createInvoice(data, userId)

3. invoices.service.createInvoice (SINGLE TRANSACTION)
   └─ BEGIN
   └─ Lock product rows (SELECT ... FOR UPDATE)
   └─ Validate stock availability
   └─ INSERT invoice (trigger auto-generates invoice_no)
   └─ INSERT invoice_items (with cost_price_snapshot)
   └─ UPDATE products.current_stock (decrement)
   └─ INSERT stock_ledger entries (movement_type = 'out')
   └─ INSERT customer_ledger debit (trigger syncs outstanding)
   └─ INSERT payment + payment_modes_detail (if paid)
   └─ INSERT customer_ledger credit (if paid)
   └─ COMMIT

4. Queue PDF job (async, never rolls back invoice on failure)

5. Frontend polls GET /api/invoices/:id/pdf-status every 2s
```

## File Storage

- **S3 bucket:** `uma-erp-storage` (private, ap-south-1)
- **Objects:** PDF invoices stored by invoice ID
- **Access:** Pre-signed URLs with 1-hour expiry
- **Fallback:** Local filesystem under `pdf-output/` when S3 unavailable

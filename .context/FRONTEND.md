# Frontend — React Application

## Stack
- **React 18** (functional components + hooks)
- **Ant Design 5** — the ONLY UI library. Do not introduce Tailwind, shadcn, Material UI
- **React Router 6** — client-side routing
- **Zustand** — auth state only
- **Vite** — build tool (must build locally, not on t2.micro EC2)
- **dayjs** — date handling (used with Ant Design DatePicker)

## Routes (App.jsx)

| Path | Component | Protected |
|------|-----------|-----------|
| `/login` | LoginPage | No |
| `/dashboard` | DashboardPage | Yes |
| `/billing` | BillingPage | Yes |
| `/billing/quick` | BillingPage (quick mode) | Yes |
| `/invoices` | InvoicesPage | Yes |
| `/invoices/:id` | InvoiceDetailPage | Yes |
| `/customers` | CustomersPage | Yes |
| `/customers/:id` | CustomerDetailPage | Yes |
| `/products` | ProductsPage | Yes |
| `/products/low-stock` | LowStockPage | Yes |
| `/products/:id` | ProductDetailPage | Yes |
| `/suppliers` | SuppliersPage | Yes |
| `/suppliers/:id` | SupplierDetailPage | Yes |
| `/purchases` | PurchasesPage | Yes |
| `/purchases/new` | NewPurchasePage | Yes |
| `/purchases/:id` | PurchaseDetailPage | Yes |
| `/payments` | PaymentsPage | Yes |
| `/reports` | ReportsIndexPage | Yes |
| `/reports/sales` | SalesReportPage | Yes |
| `/reports/gst` | GstReportPage | Yes |
| `/reports/stock` | StockReportPage | Yes |
| `/reports/stock-movement` | StockMovementPage | Yes |
| `/reports/customer-dues` | CustomerDuesPage | Yes |
| `/reports/profit` | ProfitReportPage | Yes |
| `/reports/collections` | CollectionsReportPage | Yes |
| `/settings` | SettingsPage | Yes |

## State Management

### Auth Store (Zustand — `store/authStore.js`)
```
State:  accessToken, user, isAuthenticated, isInitializing
Actions: login(token, user), logout(), setToken(token), initialize()
```
- `initialize()` called on app mount — attempts refresh token to restore session
- On 401 response: axios interceptor calls `logout()` + redirects to `/login`
- Token stored in memory only (not localStorage)

### Local State
All page-level state uses `useState`/`useReducer`. No Redux, no React Query.

## Key Hooks

### useBilling (`hooks/useBilling.js`)
Central hook for the billing page. Manages:
- **Customer:** `customer`, `setCustomer` — auto-sets bill type based on customer type
- **Bill type:** `billType`, `setBillType` — 'retail' | 'wholesale' | 'quickbill'
- **Items:** `items`, `addItem(product)`, `updateItem(index, field, value)`, `removeItem(index)`
- **Payment:** `payment`, `setPaymentAmount`, `addPaymentMode`, `removePaymentMode`
- **Totals:** Computed via `useMemo` using `billing.calculations.js`
- **Submit:** `submitInvoice()` → validates → POST /api/invoices → returns invoice or null
- **Reset:** `resetBilling()` — clears all state

### useProductSearch (`hooks/useProductSearch.js`)
- **Text search:** 150ms debounce, min 2 chars, max 8 results
- **Barcode search:** Instant lookup (no debounce)
- Adds `stock_status` and `display_price` to results
- Returns: `{ query, setQuery, results, isLoading, searchByBarcode }`

## Billing Page — Keyboard-First UX

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| F2 | Toggle Quick Bill mode |
| F4 | Pay Full amount |
| F9 | Finalize bill (submit) |
| Esc | Clear bill |
| Ctrl+P | Print last invoice PDF |

### Field Navigation (Enter/Tab progresses)
```
Customer Search → Product Search → [select product] →
Qty → Enter → Rate → Enter → Disc% → Enter → Product Search (loop)
```

### Refs & Focus
- `qtyInputRefs` / `rateInputRefs` / `discInputRefs` — per-row InputNumber refs
- `focusAndSelect()` helper — focuses Ant Design InputNumber and selects text

## Billing Calculations (`utils/billing.calculations.js`)

**Must stay in sync with backend `invoices.service.js`.**

### Exported Functions
1. **`calculateLineItem(item)`** — Computes discount_amount, taxable_amount, gst_amount, line_total, line_profit
2. **`calculateInvoiceTotals(items)`** — Sums to subtotal, discount_total, taxable_total, gst_total, grand_total, total_profit, profit_pct
3. **`getPaymentStatus(grand_total, amount_paid)`** — Returns 'paid' | 'partial' | 'unpaid'
4. **`buildGstBreakdown(items)`** — Groups by GST rate, splits CGST/SGST (each = GST/2)

### Formulas
```
discount_amount = rate * (discount_pct / 100)
taxable_amount  = (rate - discount_amount) * qty
gst_amount      = taxable_amount * (gst_pct / 100)
line_total      = taxable_amount + gst_amount
line_profit     = (rate - discount_amount - cost_price_snapshot) * qty

Invoice:
grand_total = taxable_total + gst_total
profit_pct  = (profit_amount / taxable_total) * 100
```

## API Layer (`api/axios.js`)

```js
baseURL: import.meta.env.VITE_API_URL || '/api'
withCredentials: true  // for httpOnly refresh cookie
```

**Request interceptor:** Attaches `Authorization: Bearer <token>` from Zustand store.
**Response interceptor:** On 401 → `logout()` + redirect to `/login`.

**WARNING:** Empty string `VITE_API_URL=""` is truthy in JS — the `||` fallback won't trigger. Set it to a real URL or omit it entirely.

## API Files
Each module has a dedicated API file:
- `api/auth.api.js` — login, logout, refreshToken
- `api/products.api.js` — CRUD, search, stock ledger, price history
- `api/customers.api.js` — CRUD, search, ledger, summary
- `api/invoices.api.js` — create, list, detail, PDF, return
- `api/payments.api.js` — record, list
- `api/purchases.api.js` — create, list, detail, returns
- `api/suppliers.api.js` — CRUD
- `api/reports.api.js` — all report data + exports
- `api/settings.api.js` — get settings

## Components

### AppLayout (`components/AppLayout.jsx`)
- Collapsible sidebar with 9 menu items: Dashboard, Billing, Invoices, Customers, Products, Purchases, Suppliers, Reports, Settings
- Header: user name + logout button
- Footer: "UMA Enterprises v1.0"
- Active menu based on pathname prefix

### PrivateRoute (`components/PrivateRoute.jsx`)
Auth guard — redirects to `/login` if not authenticated.

### ProductSearch / CustomerSearch
Reusable search dropdowns with debounce. Used in billing page and other forms.

### ReportLayout (`components/Reports/ReportLayout.jsx`)
Standard report page layout: title, export button, filters, summary cards, data table.

## Formatting (`utils/formatCurrency.js`)

```js
formatINR(amount)   → "₹1,234.56" (en-IN locale)
formatDate(dateStr) → "DD-MM-YYYY" or '—' if empty
```

## Key Frontend Conventions
- All DB field names used as-is (snake_case) in frontend — no camelCase mapping
- Invoice detail returns flat customer fields: `customer_name`, `customer_phone`, `customer_gstin` (not nested `customer.name`)
- Invoice status field is `status` (not `payment_status`)
- Payment date field is `payment_date` (not `date`)
- PDF is never exposed to customer — only purchase_price, profit, cost are hidden from PDFs

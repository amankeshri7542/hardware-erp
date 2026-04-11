# Known Issues & Technical Debt

Last updated: 2026-04-11

## Infrastructure Issues

### No HTTPS
- Site runs on HTTP only at `http://13.204.240.166`
- Needs: domain name + Let's Encrypt cert + nginx SSL config
- **Priority:** High — refresh token cookie `secure: false` is a workaround; set to `true` once HTTPS is live

### No Redis/ElastiCache
- BullMQ PDF queue falls back to direct Puppeteer in API process
- Redis ECONNREFUSED errors in PM2 logs (expected — app handles gracefully)
- PDF generation now works via `generatePdfDirect()` fallback using Google Chrome
- **Fix:** Install Redis on server (`sudo apt install redis-server`) for proper async queue

### Puppeteer / PDF on EC2
- Fixed: Google Chrome installed at `/usr/bin/google-chrome-stable`
- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable` set in backend `.env`
- `--disable-gpu`, `--no-zygote` flags added to pdf.js for headless service context
- Old `chromium-browser` snap wrapper removed from env

### EC2 t2.micro Limitations
- Cannot run `npm run build` (Vite) — out of memory
- Must build frontend locally on Mac and SCP dist to server
- **Fix:** Move to KVM2 or set up GitHub Actions CI/CD

## Security Issues

### No HTTPS (repeat — high priority)
- JWT tokens travel in plaintext on HTTP
- Refresh token cookie set with `secure: false` (workaround for HTTP)

### Credentials in `.env`
- `.env` is gitignored but was accidentally shown in terminal output
- GitHub PAT `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` — **rotate immediately**
- JWT_SECRET is a JWT token (not a random secret) — regenerate with `node -e "require('crypto').randomBytes(64).toString('hex')"`
- AWS IAM keys in `.env` — ensure IAM role has minimal permissions

### Auth Token in localStorage
- Access token stored in localStorage (intentional workaround for HTTP + cookie issue)
- Move back to memory-only once HTTPS is configured and cookie `secure: true`

## Code Quality Issues

### No Automated Tests
- Zero unit tests, integration tests, or E2E tests
- All testing is manual via browser
- **Priority:** Medium — add at minimum: invoice creation, payment recording, stock ledger tests

### No CI/CD Pipeline
- Manual deployment: build Mac → SCP → SSH → pm2 restart
- **Fix:** GitHub Actions → build → scp → restart

## Business Logic Gaps

### No Email Integration
- No invoice email delivery, no payment receipts, no overdue reminders
- AWS SES is in dependencies but not wired up
- **Planned:** Phase 2

### product_suppliers Not Auto-Linked Before April 2026
- Creating a purchase now auto-upserts `product_suppliers` (fixed April 2026)
- Historical purchases before this fix will NOT show in supplier's "Products Supplied" tab
- **Fix:** Run backfill query if needed

### No Thermal Printer Testing
- 80mm template exists but untested with real hardware

## Recently Fixed (April 2026)

### Session fixes (April 11, 2026)
1. **Return 422** — `returnInvoiceSchema` required `original_invoice_id`, `unit`, `rate` in body but controller adds `original_invoice_id` from URL params post-validation. Fixed by removing those from schema.
2. **Supplier Products Supplied empty** — `createPurchaseWithStockIn` never wrote to `product_suppliers`. Fixed with UPSERT after each stock-in.
3. **Supplier detail ₹NaN** — suppliers don't have `outstanding_balance` column. Removed from SupplierDetailPage.
4. **Supplier purchase history wrong columns** — used `supplier_bill_no`, `amount_paid` (don't exist). Fixed to `po_number`, `total_amount`.
5. **Dashboard Spin tip warning** — removed `tip` prop (requires nested mode in AntD 5).
6. **Card bodyStyle deprecated** — changed to `styles.body` and `variant="borderless"`.
7. **Auto-logout on refresh** — fixed with localStorage token persistence + backend cookie `secure: false` + `sameSite: lax`.
8. **PDF Puppeteer crash** — installed Google Chrome, set PUPPETEER_EXECUTABLE_PATH, added headless flags.
9. **Duplicate export routes** — removed from reports.router.js (kept in exports.router.js).
10. **Array.isArray guards** — added to all setState calls on API list responses.

### Session fixes (April 10, 2026)
1. **Supplier search** — added search bar to SuppliersPage
2. **Purchase invoice upload** — new feature: multer v2, S3/local upload, view in detail page
3. **New Supplier button in Purchases** — inline modal
4. **Create New Product in Purchases** — ProductFormModal reuse
5. **Billing unit dropdown** — hardware units for all products
6. **Billing GST% editable** — InputNumber per line item
7. **Startup env validation** — server.js exits loudly if JWT_SECRET etc. missing
8. **multer 1.x → 2.x** — security upgrade
9. **bcrypt 5.x → 6.x** — fixes tar vulnerability chain (0 vulnerabilities)
10. **DB migration 008** — `notes`, `invoice_file_url` columns on purchases table

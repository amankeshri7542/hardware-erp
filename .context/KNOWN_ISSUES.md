# Known Issues & Technical Debt

Last updated: 2026-04-05

## Infrastructure Issues

### No HTTPS
- Site runs on HTTP only at `http://13.204.240.166`
- Needs: domain name + ACM certificate + nginx SSL config
- **Priority:** High — required before any sensitive data goes live

### No Redis/ElastiCache
- BullMQ PDF queue falls back to direct Puppeteer in API process
- PDF generation blocks the API thread briefly
- Acceptable at current scale (100-150 invoices/day), but won't scale
- **Fix:** Add ElastiCache Redis for proper async PDF pipeline

### EC2 t2.micro Limitations
- Cannot run `npm run build` (Vite) — out of memory
- Must build frontend locally on Mac and SCP dist to server
- **Fix:** Upgrade to t3.small or set up CI/CD pipeline

## Code Quality Issues

### No Automated Tests
- Zero unit tests, integration tests, or E2E tests
- All testing is manual via browser
- **Priority:** Medium — add at minimum: invoice creation test, payment recording test, stock ledger consistency test

### No CI/CD Pipeline
- Manual deployment via SCP + SSH
- No automated linting, testing, or build verification
- **Fix:** GitHub Actions → build frontend → SCP → restart PM2

### Duplicate Export Routes
- Export endpoints are mounted in both `reports.router.js` and `exports.router.js`
- Both work, but it's confusing — should consolidate to one router
- **Impact:** Low (no bugs, just messy)

## Business Logic Gaps

### No Email Integration
- No invoice email delivery
- No payment receipt emails
- No overdue reminders
- **Planned:** AWS SES integration (Phase 2)

### No Thermal Printer Support
- 80mm template exists (`invoice-thermal.html`) but is untested
- Thermal printer hardware integration not verified
- **Fix:** Test with actual thermal printer

### No Barcode Scanner Testing
- Barcode lookup API works, but hardware barcode scanner integration untested
- Should work (scanner types keyboard input), but needs verification

### No Multi-User Concurrency Testing
- Designed for 2-3 users, but no load testing done
- Product stock locking (SELECT FOR UPDATE) should handle races, but untested under load

## Data Integrity Concerns

### No Backup Automation
- RDS has automated backups (7-day retention), but no verified restore process
- No separate backup to S3 or another region
- **Fix:** Test RDS restore, add cross-region backup

### Settings Table PIN
- `supervisor_pin` stored as plaintext in settings table
- Currently set to `'0000'` — should be hashed or removed
- **Impact:** Low (single-user system), but bad practice

### No Audit Trail
- No comprehensive logging of who changed what
- `created_by` exists on some tables but not all
- Stock ledger and customer ledger track changes, but product edits don't log the user
- **Fix:** Add `updated_by` column and audit log table

## Frontend Issues

### No Offline Support
- App requires constant internet connection
- No service worker, no local caching
- Bihar internet can be unreliable
- **Fix:** Add service worker with offline queue for critical operations

### No Mobile Optimization
- Ant Design responsive components used, but billing page is desktop-first
- Works on tablet but not ideal on phone
- **Priority:** Low (primary use is desktop at counter)

### No Error Boundary on Individual Pages
- Single error boundary at App level
- A crash in one component takes down the whole page
- **Fix:** Add error boundaries around major sections

## Recently Fixed (April 2026)

These were identified in the codebase audit and fixed:

1. **InvoiceDetailPage field mismatches** — 12+ wrong field names causing ₹NaN displays (e.g., `payment_status` → `status`, `total_taxable` → `taxable_total`)
2. **All 7 report pages** — Systematic camelCase vs snake_case mismatch between backend and frontend
3. **deleteUnitConversion argument mismatch** — Controller passed 1 arg but service expected 2
4. **Stock adjustment not atomic** — Product UPDATE and stock_ledger INSERT were separate queries, now wrapped in transaction
5. **Reports camelCase mapping removed** — Backend was mapping to camelCase but frontend expected snake_case
6. **Invoice list missing summary** — Added total_sales, total_gst, total_profit to listInvoices API
7. **Sales report bill_type filter** — Controller destructured wrong param name
8. **Frequent products feature removed** — Cleaned up unused search endpoint and frontend code

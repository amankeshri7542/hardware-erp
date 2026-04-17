# Known Issues, TODOs & Future Enhancements

> Last updated: 2026-04-17

## Critical — Must Fix Before Real Customer Data

### No HTTPS
- **Risk:** All data in plaintext, cookies interceptable, JWT tokens exposed
- **Fix:** Buy domain → Let's Encrypt certbot → update nginx.conf
- **Impact:** Also blocks PWA installation (needs HTTPS + service worker)

### Weak JWT Secrets
- **Risk:** Token forgery if secret is guessable
- **Fix:** `openssl rand -hex 32` → update both `JWT_SECRET` and `JWT_REFRESH_SECRET` in `.env`

### Cookie `secure: false`
- **Risk:** Refresh token sent over HTTP
- **Fix:** Set `secure: true` in cookie options after HTTPS is enabled

### DB SSL `rejectUnauthorized: false`
- **Risk:** Man-in-the-middle on DB connection
- **Fix:** Download AWS RDS CA certificate, enable validation in `config/db.js`

## High Priority

### No CSRF Protection
- **Risk:** Cross-site request forgery attacks
- **Fix:** Add `csurf` middleware or set `SameSite=Strict` on refresh token cookie

### No Refresh Token Blacklist
- **Risk:** Stolen refresh tokens valid for 30 days
- **Fix:** Store revoked tokens in Redis, check on each refresh

### Single Admin Role (No RBAC)
- **Risk:** All users are super-admins — any user can see profits, delete products, etc.
- **Fix:** Add `role` enum (admin, manager, cashier), role-check middleware, restrict routes

### No Audit Logging
- **Risk:** Cannot trace who performed what action
- **Fix:** Create `audit_log` table, middleware to log user_id + action + entity + timestamp

### MIME-Type Spoofing on Uploads
- **Risk:** Malicious file upload disguised as PDF/image
- **Fix:** Validate magic bytes with `file-type` npm package (not just extension/MIME header)

## Medium Priority

### No Automated Tests
- Zero unit tests, integration tests, or E2E tests
- **Recommendation:** Start with `invoices.service.js` (most critical) and `billing.calculations.js` (must match backend)

### No CI/CD Pipeline
- Manual deployment via SCP + SSH
- GitHub Actions workflow exists but not fully operational
- **Recommendation:** Automate: lint → test → build → deploy

### No CORS Wildcard Guard
- **Risk:** Accidental `CORS_ORIGIN=*` in production
- **Fix:** Add startup check that errors on wildcard in production mode

### Supervisor PIN Plaintext
- **Risk:** Weak auth for sensitive operations
- **Fix:** Hash with bcrypt, store hash in settings

### No nginx Security Headers
- Missing: HSTS, Permissions-Policy, X-Permitted-Cross-Domain-Policies
- **Fix:** Add to nginx.conf after HTTPS is enabled

### No `npm audit` in CI
- **Risk:** Dependency vulnerabilities go undetected
- **Fix:** Add `npm audit --audit-level=high` to build pipeline

## Low Priority / Future Enhancements

### Business Features
- **Email integration** — Send invoices/payment receipts via email (SES is in dependencies but not wired up)
- **Barcode printing** — Generate barcode labels for products
- **Multi-location support** — Multiple stores/warehouses
- **Customer portal** — Self-service invoice lookup and payment history
- **Credit limit enforcement** — Block billing when customer exceeds credit limit
- **Batch billing** — Repeat last order for regular customers
- **Discount tiers** — Customer-type-based or volume-based automatic discounts

### Technical Improvements
- **Thermal printer testing** — Template exists but untested on real hardware
- **Offline mode** — Service worker for PWA offline billing (requires HTTPS first)
- **Real-time updates** — WebSocket for multi-user stock sync
- **Database backups** — Automated daily RDS snapshots (currently manual)
- **Redis for production** — Enable BullMQ queue instead of sync PDF fallback
- **Image uploads for products** — Product photos stored in S3

## Recently Fixed (April 2026)

| Issue | Fix | Commit |
|-------|-----|--------|
| Duplicate return vulnerability | Added `qty_returned` tracking + validation | `f5beda4a` |
| Unit conversion not shown in PDFs | `{{ITEM_ROWS}}` template + buildItemRows() | `c4320d6a` |
| Unit conversion not shown in Products list | Subquery for unit_conversions in getAllProducts | `2650b523` |
| No security headers | Helmet middleware added | `2650b523` |
| No login rate limiting | express-rate-limit on login route | `2650b523` |
| Weak password allowed | Password policy: 8+ chars, uppercase, number, special | `2650b523` |
| Invoice items unlimited | Items array capped at 500 | `2650b523` |
| DB error details leaked | Error handler hides details in production | `2650b523` |
| Return updates wrong balance | Fixed to reduce balance_due on original invoice | `0cb8652b` |
| Quick Bill 422 error | Fixed validation for quickbill without customer_id | `0877fe0a` |
| Product search missing search param | Controller/service search param passthrough | `8b4234c8` |
| Auth refresh loop | Skip 401 redirect on /auth/refresh endpoint | `f2fb9419` |

## Infrastructure Notes

- **EC2 t2.micro** — Cannot run Vite builds (OOM). Build frontend on Mac, SCP dist to EC2
- **Redis not installed** on EC2 — PDF generation falls back to synchronous Puppeteer in API process
- **Puppeteer on EC2** — Uses Google Chrome at `/usr/bin/google-chrome-stable` (not bundled Chromium)
- **Single-AZ RDS** — No multi-AZ failover. Acceptable for current scale (~150 invoices/day)

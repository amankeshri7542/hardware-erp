# Security

## Authentication

- **JWT access token** — 8-hour expiry, stored in memory (Zustand), sent via `Authorization: Bearer` header
- **Refresh token** — 30-day expiry, stored in httpOnly cookie, used only for `/api/auth/refresh`
- **Password hashing** — bcrypt with cost factor 12
- **Single role** — `admin` only (all authenticated users have full access)
- Admin seed: `admin@store.local` / `Aman@9431` (in `db/seeds/001_admin_user.sql`)

## Request Security

- **CORS** — Configured in Express with `CORS_ORIGIN` env var (production: `http://13.204.240.166`)
- **Rate limiting** — express-rate-limit on all routes (configurable window/max)
- **JWT verification** — `authenticateJWT` middleware on all routes except `/api/auth/login`, `/api/auth/logout`, `/api/auth/refresh`, `/api/health`
- **Input validation** — express-validator schemas on all POST/PUT routes, validated before controller executes
- **Parameterized queries** — All SQL uses `$1, $2, $3` placeholders — never string interpolation

## Database Security

- **RDS SSL** — Connection uses `ssl: { rejectUnauthorized: false }` in production
- **No SELECT *** — All queries specify explicit column lists
- **Append-only ledgers** — stock_ledger and customer_ledger cannot be updated or deleted (trigger-enforced)
- **Negative stock prevention** — DB trigger blocks current_stock from going below 0
- **Soft deletes** — Customers and products are never hard-deleted

## File Storage Security

- **S3 bucket** — Private (`uma-erp-storage`), no public access
- **Pre-signed URLs** — 1-hour expiry for PDF downloads, generated per request
- **No direct S3 URLs** — Frontend never receives raw S3 URLs
- **Local fallback** — Uses `local://` prefix, files served via `sendFile()` only

## What Is NOT Exposed to Customers (PDF/Invoice)

These fields are internal-only and must never appear on customer-facing documents:
- `purchase_price` / `cost_price_snapshot`
- `profit_amount` / `profit_pct` / `line_profit`
- `total_cost`

## Current Security Gaps (Known)

1. **No HTTPS** — Site runs on HTTP only (needs domain + ACM certificate)
2. **No rate limiting on login** — Should add stricter per-IP limits
3. **No CSRF tokens** — Relies on CORS + httpOnly cookies
4. **No IP allowlisting** — RDS accepts connections from EC2 security group, but no WAF
5. **Supervisor PIN** — Stored in plaintext in settings table (`supervisor_pin = '0000'`)
6. **No audit trail** — User actions (who changed what) are not comprehensively logged
7. **No password complexity enforcement** — Only bcrypt hashing, no policy on password strength
8. **No session invalidation** — Cannot force-logout a user (refresh tokens not blacklisted)

## Deployment Security

- **SSH** — Key-based only (`.pem` file), no password auth
- **PM2** — Runs as `ubuntu` user, not root
- **nginx** — Reverse proxy, no direct access to Node.js port
- **Environment variables** — `.env` file on server, not in git (`.gitignore` includes `.env`)
- **Frontend build** — Done locally on Mac, SCP'd to EC2 (t2.micro can't build)

## Recommended Next Steps

1. Add HTTPS (domain + ACM certificate + nginx SSL)
2. Implement login rate limiting (5 attempts per 15 minutes per IP)
3. Add CSRF protection or switch to SameSite cookies
4. Set up AWS WAF in front of EC2
5. Add audit logging (who changed what, when)
6. Implement password complexity policy
7. Add refresh token blacklist (Redis or DB table) for session invalidation

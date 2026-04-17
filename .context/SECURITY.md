# Security

> Last updated: 2026-04-17

## What's Implemented

### Authentication
- **JWT access token** — 8-hour expiry, stored in memory (Zustand), sent via `Authorization: Bearer` header
- **JWT refresh token** — 30-day expiry, httpOnly cookie, `sameSite: 'lax'`
- **Password hashing** — bcrypt with cost factor 12
- **Password policy** — min 8 chars, requires uppercase + number + special character
- **Login rate limiting** — 5 attempts per 15 minutes per IP (express-rate-limit)

### Security Headers (Helmet)
- `X-Frame-Options: SAMEORIGIN` (anti-clickjacking)
- `X-Content-Type-Options: nosniff`
- `X-DNS-Prefetch-Control: off`
- `X-Download-Options: noopen`
- `X-XSS-Protection: 0` (modern recommendation)
- `Referrer-Policy: no-referrer`
- CSP disabled (Ant Design requires inline styles)

### SQL Injection Prevention
All queries use parameterized queries (`$1, $2, $3`). Zero string interpolation in SQL. Verified across all 11 service modules.

### Input Validation
- express-validator schemas on all POST/PUT routes
- Invoice items capped at 500 (DoS prevention)
- File upload validation: PDF/JPEG/PNG/WebP only, 5MB max (multer)

### Data Protection
- Cost prices and profit never exposed in customer-facing PDFs
- S3 bucket is private — access via pre-signed URLs (1hr expiry)
- Error handler hides DB details (column names, constraints) in production
- `UPDATABLE_FIELDS` whitelist prevents mass assignment attacks

### Database Security
- Append-only ledgers (DB triggers block UPDATE/DELETE)
- Soft deletes only (is_active = false)
- Transaction isolation for invoice creation (FOR UPDATE locks)
- Payment amount guarded: cannot exceed balance_due

## Known Gaps (To Fix)

### Critical
| Issue | Risk | Fix |
|-------|------|-----|
| **No HTTPS** | All data in plaintext, cookies interceptable | Buy domain + Let's Encrypt certbot |
| **JWT secret is weak** | Token forgery possible | `openssl rand -hex 32` → update .env |
| **Cookie `secure: false`** | Refresh token sent over HTTP | Set `true` after HTTPS |
| **DB SSL `rejectUnauthorized: false`** | MitM on DB connection | Download RDS CA cert, enable validation |

### High
| Issue | Risk | Fix |
|-------|------|-----|
| No CSRF tokens | Cross-site request forgery | Add csurf or SameSite=Strict |
| No refresh token blacklist | Stolen tokens valid for 30 days | Store revoked tokens in Redis |
| Single admin role, no RBAC | All users are super-admins | Add role checks middleware |
| No audit logging | Can't trace who did what | Create audit_log table |
| MIME-type spoofing on uploads | Malicious file upload | Validate magic bytes (file-type npm) |

### Medium
| Issue | Risk | Fix |
|-------|------|-----|
| No nginx security headers | Missing HSTS, Permissions-Policy | Add to nginx.conf |
| Supervisor PIN plaintext | Weak auth for sensitive ops | Hash with bcrypt |
| No npm audit in CI/CD | Dependency vulnerabilities | Add to GitHub Actions |
| No CORS wildcard guard | Misconfiguration risk | Error on `CORS_ORIGIN=*` in production |

## Credential Rotation Checklist

When rotating credentials (MUST do before going live with real customer data):

1. **JWT secrets:** `openssl rand -hex 32` for both JWT_SECRET and JWT_REFRESH_SECRET
2. **AWS keys:** IAM Console → create new access key → update .env → delete old key
3. **RDS password:** RDS Console → Modify → new password → update .env
4. **GitHub token:** Settings → Personal Access Tokens → regenerate
5. Never commit `.env` to git (already in .gitignore)

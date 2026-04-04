# Database Schema

PostgreSQL 15 on AWS RDS (ap-south-1). Extension: `pg_trgm` for fuzzy search.

## Tables

### users
| Column | Type | Constraints |
|--------|------|------------|
| id | SERIAL | PRIMARY KEY |
| name | VARCHAR(100) | NOT NULL |
| email | VARCHAR(255) | UNIQUE NOT NULL |
| password_hash | TEXT | NOT NULL |
| role | VARCHAR(20) | DEFAULT 'admin', CHECK IN ('admin') |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### customers
| Column | Type | Constraints |
|--------|------|------------|
| id | SERIAL | PRIMARY KEY |
| name | VARCHAR(255) | NOT NULL |
| business_name | VARCHAR(255) | |
| phone | VARCHAR(10) | UNIQUE NOT NULL |
| alt_phone | VARCHAR(15) | |
| email | VARCHAR(255) | |
| address | TEXT | |
| city | VARCHAR(100) | |
| pincode | VARCHAR(6) | |
| gstin | VARCHAR(15) | |
| type | VARCHAR(20) | DEFAULT 'retail', CHECK IN ('retail','wholesale','both') |
| credit_limit | NUMERIC(12,2) | DEFAULT 0 |
| outstanding_balance | NUMERIC(12,2) | DEFAULT 0 (auto-synced by trigger) |
| payment_terms | VARCHAR(100) | |
| notes | TEXT | |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### products
| Column | Type | Constraints |
|--------|------|------------|
| id | SERIAL | PRIMARY KEY |
| name | VARCHAR(255) | NOT NULL |
| category | VARCHAR(100) | |
| brand | VARCHAR(100) | |
| sku | VARCHAR(50) | UNIQUE |
| barcode | VARCHAR(50) | UNIQUE |
| hsn_code | VARCHAR(8) | |
| gst_rate | NUMERIC(5,2) | DEFAULT 0 |
| mrp | NUMERIC(12,2) | NOT NULL DEFAULT 0 |
| wholesale_price | NUMERIC(12,2) | NOT NULL DEFAULT 0 |
| purchase_price | NUMERIC(12,2) | NOT NULL DEFAULT 0 |
| current_stock | NUMERIC(12,3) | NOT NULL DEFAULT 0 |
| min_stock | NUMERIC(12,3) | DEFAULT 0 |
| unit | VARCHAR(20) | DEFAULT 'piece', CHECK IN ('piece','kg','box','metre','litre','set') |
| base_unit | VARCHAR(20) | DEFAULT 'piece' |
| primary_supplier_id | INTEGER | FK → suppliers(id) |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

### suppliers
| Column | Type | Constraints |
|--------|------|------------|
| id | SERIAL | PRIMARY KEY |
| name | VARCHAR(255) | NOT NULL |
| phone | VARCHAR(15) | |
| email | VARCHAR(255) | |
| gstin | VARCHAR(15) | |
| address | TEXT | |
| payment_terms | VARCHAR(100) | |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### invoices
| Column | Type | Constraints |
|--------|------|------------|
| id | SERIAL | PRIMARY KEY |
| invoice_no | VARCHAR(30) | UNIQUE NOT NULL (auto-generated) |
| customer_id | INTEGER | FK → customers(id) |
| customer_name_walkin | VARCHAR(255) | |
| bill_type | VARCHAR(20) | NOT NULL, CHECK IN ('retail','wholesale','quickbill') |
| date | DATE | NOT NULL DEFAULT CURRENT_DATE |
| subtotal | NUMERIC(12,2) | DEFAULT 0 |
| discount_total | NUMERIC(12,2) | DEFAULT 0 |
| taxable_total | NUMERIC(12,2) | DEFAULT 0 |
| gst_total | NUMERIC(12,2) | DEFAULT 0 |
| grand_total | NUMERIC(12,2) | DEFAULT 0 |
| total_cost | NUMERIC(12,2) | DEFAULT 0 |
| profit_amount | NUMERIC(12,2) | DEFAULT 0 |
| profit_pct | NUMERIC(5,2) | DEFAULT 0 |
| amount_paid | NUMERIC(12,2) | DEFAULT 0 |
| balance_due | NUMERIC(12,2) | DEFAULT 0 |
| due_date | DATE | |
| status | VARCHAR(10) | NOT NULL DEFAULT 'unpaid', CHECK IN ('paid','partial','unpaid') |
| pdf_url | TEXT | |
| pdf_status | VARCHAR(10) | DEFAULT 'pending', CHECK IN ('pending','ready','failed') |
| created_by | INTEGER | FK → users(id) |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### invoice_items
| Column | Type | Constraints |
|--------|------|------------|
| id | SERIAL | PRIMARY KEY |
| invoice_id | INTEGER | NOT NULL, FK → invoices(id) |
| product_id | INTEGER | NOT NULL, FK → products(id) |
| product_name_snapshot | VARCHAR(255) | NOT NULL |
| hsn_snapshot | VARCHAR(8) | |
| qty | NUMERIC(12,3) | NOT NULL |
| unit | VARCHAR(20) | |
| rate | NUMERIC(12,2) | NOT NULL |
| discount_pct | NUMERIC(5,2) | DEFAULT 0 |
| discount_amount | NUMERIC(12,2) | DEFAULT 0 |
| taxable_amount | NUMERIC(12,2) | NOT NULL |
| gst_pct | NUMERIC(5,2) | DEFAULT 0 |
| gst_amount | NUMERIC(12,2) | DEFAULT 0 |
| line_total | NUMERIC(12,2) | NOT NULL |
| cost_price_snapshot | NUMERIC(12,2) | DEFAULT 0 |
| line_profit | NUMERIC(12,2) | DEFAULT 0 |
| alt_qty | NUMERIC(12,3) | |
| alt_unit | VARCHAR(30) | |
| base_qty | NUMERIC(12,3) | |

### payments
| Column | Type | Constraints |
|--------|------|------------|
| id | SERIAL | PRIMARY KEY |
| customer_id | INTEGER | FK → customers(id) |
| invoice_id | INTEGER | FK → invoices(id) |
| amount | NUMERIC(12,2) | NOT NULL |
| mode | VARCHAR(10) | NOT NULL, CHECK IN ('cash','upi','bank','cheque','mixed') |
| reference_no | VARCHAR(100) | |
| payment_date | DATE | NOT NULL DEFAULT CURRENT_DATE |
| notes | TEXT | |
| created_by | INTEGER | FK → users(id) |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### payment_modes_detail
For mixed payments — one row per sub-mode.

| Column | Type | Constraints |
|--------|------|------------|
| id | SERIAL | PRIMARY KEY |
| payment_id | INTEGER | NOT NULL, FK → payments(id) |
| mode | VARCHAR(10) | NOT NULL, CHECK IN ('cash','upi','bank','cheque') |
| amount | NUMERIC(12,2) | NOT NULL |
| reference_no | VARCHAR(100) | |

### stock_ledger
**APPEND-ONLY** — trigger blocks UPDATE/DELETE.

| Column | Type | Constraints |
|--------|------|------------|
| id | SERIAL | PRIMARY KEY |
| product_id | INTEGER | NOT NULL, FK → products(id) |
| date | DATE | NOT NULL DEFAULT CURRENT_DATE |
| movement_type | VARCHAR(20) | NOT NULL, CHECK IN ('in','out','return_in','return_out','adjustment') |
| reference_id | INTEGER | |
| reference_type | VARCHAR(20) | |
| qty_in | NUMERIC(12,3) | DEFAULT 0 |
| qty_out | NUMERIC(12,3) | DEFAULT 0 |
| stock_after | NUMERIC(12,3) | NOT NULL |
| notes | TEXT | |
| created_by | INTEGER | FK → users(id) |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### customer_ledger
**APPEND-ONLY** — trigger blocks UPDATE/DELETE.

| Column | Type | Constraints |
|--------|------|------------|
| id | SERIAL | PRIMARY KEY |
| customer_id | INTEGER | NOT NULL, FK → customers(id) |
| date | DATE | NOT NULL DEFAULT CURRENT_DATE |
| entry_type | VARCHAR(20) | NOT NULL, CHECK IN ('invoice','payment','return','adjustment','advance') |
| reference_id | INTEGER | |
| reference_type | VARCHAR(20) | |
| debit | NUMERIC(12,2) | DEFAULT 0 |
| credit | NUMERIC(12,2) | DEFAULT 0 |
| balance | NUMERIC(12,2) | DEFAULT 0 |
| description | TEXT | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### purchases
| Column | Type | Constraints |
|--------|------|------------|
| id | SERIAL | PRIMARY KEY |
| supplier_id | INTEGER | NOT NULL, FK → suppliers(id) |
| po_number | VARCHAR(50) | |
| date | DATE | NOT NULL DEFAULT CURRENT_DATE |
| total_amount | NUMERIC(12,2) | DEFAULT 0 |
| status | VARCHAR(20) | DEFAULT 'draft', CHECK IN ('draft','received') |
| created_by | INTEGER | FK → users(id) |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### purchase_items
| Column | Type | Constraints |
|--------|------|------------|
| id | SERIAL | PRIMARY KEY |
| purchase_id | INTEGER | NOT NULL, FK → purchases(id) |
| product_id | INTEGER | NOT NULL, FK → products(id) |
| qty | NUMERIC(12,3) | NOT NULL |
| unit | VARCHAR(20) | |
| cost_price | NUMERIC(12,2) | NOT NULL |
| line_total | NUMERIC(12,2) | NOT NULL |

### purchase_returns
| Column | Type | Constraints |
|--------|------|------------|
| id | SERIAL | PRIMARY KEY |
| return_no | VARCHAR(30) | UNIQUE NOT NULL (auto-generated PR-YYYY-NNNNN) |
| purchase_id | INTEGER | NOT NULL, FK → purchases(id) |
| supplier_id | INTEGER | NOT NULL, FK → suppliers(id) |
| return_date | DATE | NOT NULL DEFAULT CURRENT_DATE |
| total_amount | NUMERIC(12,2) | DEFAULT 0 |
| reason | TEXT | |
| status | VARCHAR(20) | DEFAULT 'pending', CHECK IN ('pending','accepted','rejected') |
| created_by | INTEGER | FK → users(id) |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

### purchase_return_items
| Column | Type | Constraints |
|--------|------|------------|
| id | SERIAL | PRIMARY KEY |
| purchase_return_id | INTEGER | NOT NULL, FK → purchase_returns(id) |
| product_id | INTEGER | NOT NULL, FK → products(id) |
| qty_returned | NUMERIC(12,3) | NOT NULL |
| unit_price | NUMERIC(12,2) | NOT NULL |
| amount | NUMERIC(12,2) | NOT NULL |
| reason | TEXT | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### supplier_debit_notes
| Column | Type | Constraints |
|--------|------|------------|
| id | SERIAL | PRIMARY KEY |
| debit_note_no | VARCHAR(30) | UNIQUE NOT NULL |
| purchase_return_id | INTEGER | NOT NULL, FK → purchase_returns(id) |
| supplier_id | INTEGER | NOT NULL, FK → suppliers(id) |
| amount | NUMERIC(12,2) | NOT NULL |
| status | VARCHAR(20) | DEFAULT 'outstanding', CHECK IN ('outstanding','adjusted','cancelled') |
| adjusted_in_purchase_id | INTEGER | FK → purchases(id) |
| notes | TEXT | |
| created_by | INTEGER | FK → users(id) |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

### product_unit_conversions
| Column | Type | Constraints |
|--------|------|------------|
| id | SERIAL | PRIMARY KEY |
| product_id | INTEGER | NOT NULL, FK → products(id) |
| unit_name | VARCHAR(30) | NOT NULL |
| conversion_value | NUMERIC(12,4) | NOT NULL |
| is_purchase_unit | BOOLEAN | DEFAULT false |
| is_sales_unit | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| | | UNIQUE(product_id, unit_name) |

### product_price_history
| Column | Type | Constraints |
|--------|------|------------|
| id | SERIAL | PRIMARY KEY |
| product_id | INTEGER | NOT NULL, FK → products(id) |
| effective_from | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |
| effective_to | TIMESTAMPTZ | NULL = current price |
| purchase_price | NUMERIC(12,2) | |
| wholesale_price | NUMERIC(12,2) | |
| mrp | NUMERIC(12,2) | |
| changed_by | INTEGER | FK → users(id) |
| source | VARCHAR(20) | DEFAULT 'manual', CHECK IN ('manual','billing','purchase') |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### product_suppliers
| Column | Type | Constraints |
|--------|------|------------|
| id | SERIAL | PRIMARY KEY |
| product_id | INTEGER | NOT NULL, FK → products(id) |
| supplier_id | INTEGER | NOT NULL, FK → suppliers(id) |
| last_price | NUMERIC(12,2) | |
| last_purchase_date | DATE | |
| last_unit | VARCHAR(20) | |
| is_primary_supplier | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |
| | | UNIQUE(product_id, supplier_id) |

### settings
| Column | Type | Constraints |
|--------|------|------------|
| key | VARCHAR(100) | PRIMARY KEY |
| value | TEXT | NOT NULL |
| description | TEXT | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

## Sequences

| Sequence | Format | Used By |
|----------|--------|---------|
| retail_invoice_seq | RETAIL-YYYY-NNNNN | Retail invoices |
| wholesale_invoice_seq | WHOLE-YYYY-NNNNN | Wholesale invoices |
| quickbill_invoice_seq | QB-YYYY-NNNNN | Quick bill invoices |
| purchase_return_seq | PR-YYYY-NNNNN | Purchase returns |
| debit_note_seq | DN-YYYY-NNNNN | Debit notes |

## Triggers & Functions

| Trigger | Table | Event | Action |
|---------|-------|-------|--------|
| trg_prevent_negative_stock | products | BEFORE UPDATE | Blocks current_stock < 0 |
| trg_sync_customer_outstanding | customer_ledger | AFTER INSERT | Recalculates customers.outstanding_balance |
| trg_auto_generate_invoice_no | invoices | BEFORE INSERT | Auto-fills invoice_no from sequence |
| trg_auto_generate_return_no | purchase_returns | BEFORE INSERT | Auto-fills return_no from sequence |
| trg_customer_ledger_append_only | customer_ledger | BEFORE UPDATE/DELETE | Raises exception |
| trg_stock_ledger_append_only | stock_ledger | BEFORE UPDATE/DELETE | Raises exception |

## Indexes

**GIN (fuzzy search):**
- `idx_products_name_trgm` ON products(name) using gin_trgm_ops
- `idx_customers_name_trgm` ON customers(name) using gin_trgm_ops

**B-Tree (lookups):**
- `idx_customers_phone` ON customers(phone)
- `idx_products_barcode` ON products(barcode)
- `idx_products_sku` ON products(sku)
- `idx_invoices_customer_id` ON invoices(customer_id)
- `idx_invoices_created_at` ON invoices(created_at)
- `idx_customer_ledger_customer_id` ON customer_ledger(customer_id)
- `idx_stock_ledger_product_id` ON stock_ledger(product_id)
- Plus indexes on all FK columns in newer tables (unit conversions, price history, suppliers, returns, debit notes)

## Critical DB Rules

1. **Append-only ledgers** — stock_ledger and customer_ledger cannot be updated or deleted
2. **No negative stock** — trigger prevents current_stock from going below 0
3. **Auto-sync outstanding** — customer_ledger INSERT triggers recalculation of customers.outstanding_balance
4. **Auto-numbering** — invoices and purchase returns get sequential numbers via triggers
5. **NUMERIC(12,2) for money** — never use floating point for financial data
6. **Soft deletes only** — set `is_active = false`, never hard-delete customers/products
7. **Cost snapshots are immutable** — invoice_items.cost_price_snapshot is frozen at billing time

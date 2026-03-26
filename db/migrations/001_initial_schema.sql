-- Migration 001: Initial Schema
-- Hardware Store ERP v1.0
-- Run once on fresh RDS instance
-- Requires pg_trgm extension (line 1 handles this)

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SUPPLIERS
-- ============================================================
CREATE TABLE suppliers (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    phone           VARCHAR(15),
    email           VARCHAR(255),
    gstin           VARCHAR(15),
    address         TEXT,
    payment_terms   VARCHAR(100),
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE customers (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(255) NOT NULL,
    business_name       VARCHAR(255),
    phone               VARCHAR(10) UNIQUE NOT NULL,
    alt_phone           VARCHAR(15),
    email               VARCHAR(255),
    address             TEXT,
    city                VARCHAR(100),
    pincode             VARCHAR(6),
    gstin               VARCHAR(15),
    type                VARCHAR(20) DEFAULT 'retail' CHECK (type IN ('retail','wholesale','both')),
    credit_limit        NUMERIC(12,2) DEFAULT 0,
    outstanding_balance NUMERIC(12,2) DEFAULT 0,
    payment_terms       VARCHAR(100),
    notes               TEXT,
    is_active           BOOLEAN DEFAULT true,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE products (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    category        VARCHAR(100),
    brand           VARCHAR(100),
    sku             VARCHAR(50) UNIQUE,
    barcode         VARCHAR(50) UNIQUE,
    hsn_code        VARCHAR(8),
    gst_rate        NUMERIC(5,2) DEFAULT 0,
    mrp             NUMERIC(12,2) NOT NULL DEFAULT 0,
    wholesale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    purchase_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
    current_stock   NUMERIC(12,3) NOT NULL DEFAULT 0,
    min_stock       NUMERIC(12,3) DEFAULT 0,
    unit            VARCHAR(20) DEFAULT 'piece' CHECK (unit IN ('piece','kg','box','metre','litre','set')),
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE invoices (
    id                      SERIAL PRIMARY KEY,
    invoice_no              VARCHAR(30) UNIQUE NOT NULL,
    customer_id             INTEGER REFERENCES customers(id),
    customer_name_walkin    VARCHAR(255),
    bill_type               VARCHAR(20) NOT NULL CHECK (bill_type IN ('retail','wholesale','quickbill')),
    date                    DATE NOT NULL DEFAULT CURRENT_DATE,
    subtotal                NUMERIC(12,2) DEFAULT 0,
    discount_total          NUMERIC(12,2) DEFAULT 0,
    taxable_total           NUMERIC(12,2) DEFAULT 0,
    gst_total               NUMERIC(12,2) DEFAULT 0,
    grand_total             NUMERIC(12,2) DEFAULT 0,
    total_cost              NUMERIC(12,2) DEFAULT 0,
    profit_amount           NUMERIC(12,2) DEFAULT 0,
    profit_pct              NUMERIC(5,2) DEFAULT 0,
    amount_paid             NUMERIC(12,2) DEFAULT 0,
    balance_due             NUMERIC(12,2) DEFAULT 0,
    due_date                DATE,
    status                  VARCHAR(10) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('paid','partial','unpaid')),
    pdf_url                 TEXT,
    pdf_status              VARCHAR(10) DEFAULT 'pending' CHECK (pdf_status IN ('pending','ready','failed')),
    created_by              INTEGER REFERENCES users(id),
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INVOICE ITEMS
-- ============================================================
CREATE TABLE invoice_items (
    id                      SERIAL PRIMARY KEY,
    invoice_id              INTEGER NOT NULL REFERENCES invoices(id),
    product_id              INTEGER NOT NULL REFERENCES products(id),
    product_name_snapshot   VARCHAR(255) NOT NULL,
    hsn_snapshot            VARCHAR(8),
    qty                     NUMERIC(12,3) NOT NULL,
    unit                    VARCHAR(20),
    rate                    NUMERIC(12,2) NOT NULL,
    discount_pct            NUMERIC(5,2) DEFAULT 0,
    discount_amount         NUMERIC(12,2) DEFAULT 0,
    taxable_amount          NUMERIC(12,2) NOT NULL,
    gst_pct                 NUMERIC(5,2) DEFAULT 0,
    gst_amount              NUMERIC(12,2) DEFAULT 0,
    line_total              NUMERIC(12,2) NOT NULL,
    cost_price_snapshot     NUMERIC(12,2) DEFAULT 0,
    line_profit             NUMERIC(12,2) DEFAULT 0
);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE payments (
    id              SERIAL PRIMARY KEY,
    customer_id     INTEGER REFERENCES customers(id),
    invoice_id      INTEGER REFERENCES invoices(id),
    amount          NUMERIC(12,2) NOT NULL,
    mode            VARCHAR(10) NOT NULL CHECK (mode IN ('cash','upi','bank','cheque','mixed')),
    reference_no    VARCHAR(100),
    payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    notes           TEXT,
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PAYMENT MODES DETAIL
-- ============================================================
CREATE TABLE payment_modes_detail (
    id              SERIAL PRIMARY KEY,
    payment_id      INTEGER NOT NULL REFERENCES payments(id),
    mode            VARCHAR(10) NOT NULL CHECK (mode IN ('cash','upi','bank','cheque')),
    amount          NUMERIC(12,2) NOT NULL,
    reference_no    VARCHAR(100)
);

-- ============================================================
-- CUSTOMER LEDGER
-- ============================================================
CREATE TABLE customer_ledger (
    id              SERIAL PRIMARY KEY,
    customer_id     INTEGER NOT NULL REFERENCES customers(id),
    date            DATE NOT NULL DEFAULT CURRENT_DATE,
    entry_type      VARCHAR(20) NOT NULL CHECK (entry_type IN ('invoice','payment','return','adjustment','advance')),
    reference_id    INTEGER,
    reference_type  VARCHAR(20),
    debit           NUMERIC(12,2) DEFAULT 0,
    credit          NUMERIC(12,2) DEFAULT 0,
    balance         NUMERIC(12,2) DEFAULT 0,
    description     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STOCK LEDGER
-- ============================================================
CREATE TABLE stock_ledger (
    id              SERIAL PRIMARY KEY,
    product_id      INTEGER NOT NULL REFERENCES products(id),
    date            DATE NOT NULL DEFAULT CURRENT_DATE,
    movement_type   VARCHAR(20) NOT NULL CHECK (movement_type IN ('in','out','return_in','return_out','adjustment')),
    reference_id    INTEGER,
    reference_type  VARCHAR(20),
    qty_in          NUMERIC(12,3) DEFAULT 0,
    qty_out         NUMERIC(12,3) DEFAULT 0,
    stock_after     NUMERIC(12,3) NOT NULL,
    notes           TEXT,
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PURCHASES
-- ============================================================
CREATE TABLE purchases (
    id              SERIAL PRIMARY KEY,
    supplier_id     INTEGER NOT NULL REFERENCES suppliers(id),
    po_number       VARCHAR(50),
    date            DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount    NUMERIC(12,2) DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','received')),
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PURCHASE ITEMS
-- ============================================================
CREATE TABLE purchase_items (
    id              SERIAL PRIMARY KEY,
    purchase_id     INTEGER NOT NULL REFERENCES purchases(id),
    product_id      INTEGER NOT NULL REFERENCES products(id),
    qty             NUMERIC(12,3) NOT NULL,
    unit            VARCHAR(20),
    cost_price      NUMERIC(12,2) NOT NULL,
    line_total      NUMERIC(12,2) NOT NULL
);

-- ============================================================
-- SEQUENCES (for invoice number generation)
-- ============================================================
CREATE SEQUENCE retail_invoice_seq START 1;
CREATE SEQUENCE wholesale_invoice_seq START 1;
CREATE SEQUENCE quickbill_invoice_seq START 1;

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================
CREATE INDEX idx_products_name_trgm ON products USING GIN (name gin_trgm_ops);
CREATE INDEX idx_customers_name_trgm ON customers USING GIN (name gin_trgm_ops);
CREATE INDEX idx_customers_phone ON customers (phone);
CREATE INDEX idx_products_barcode ON products (barcode);
CREATE INDEX idx_products_sku ON products (sku);
CREATE INDEX idx_invoices_customer_id ON invoices (customer_id);
CREATE INDEX idx_customer_ledger_customer_id ON customer_ledger (customer_id);
CREATE INDEX idx_stock_ledger_product_id ON stock_ledger (product_id);
CREATE INDEX idx_invoices_created_at ON invoices (created_at);

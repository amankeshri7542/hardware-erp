-- ============================================================================
-- Migration 005: Purchase Returns & Supplier Debit Notes
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- PURCHASE RETURNS
-- When defective/wrong goods are returned to a supplier
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_returns (
    id                SERIAL PRIMARY KEY,
    return_no         VARCHAR(30) NOT NULL UNIQUE,
    purchase_id       INTEGER NOT NULL REFERENCES purchases(id),
    supplier_id       INTEGER NOT NULL REFERENCES suppliers(id),
    return_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
    reason            TEXT,
    status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','accepted','rejected')),
    created_by        INTEGER REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_returns_purchase ON purchase_returns(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_supplier ON purchase_returns(supplier_id);

-- ────────────────────────────────────────────────────────────────────────────
-- PURCHASE RETURN ITEMS
-- Individual line items in a purchase return
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_return_items (
    id                  SERIAL PRIMARY KEY,
    purchase_return_id  INTEGER NOT NULL REFERENCES purchase_returns(id),
    product_id          INTEGER NOT NULL REFERENCES products(id),
    qty_returned        NUMERIC(12,3) NOT NULL,
    unit_price          NUMERIC(12,2) NOT NULL,
    amount              NUMERIC(12,2) NOT NULL,
    reason              TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_return_items_return ON purchase_return_items(purchase_return_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_product ON purchase_return_items(product_id);

-- ────────────────────────────────────────────────────────────────────────────
-- SUPPLIER DEBIT NOTES
-- Tracks amounts owed by suppliers for returned goods
-- ────────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS debit_note_seq START WITH 1;

CREATE TABLE IF NOT EXISTS supplier_debit_notes (
    id                  SERIAL PRIMARY KEY,
    debit_note_no       VARCHAR(30) NOT NULL UNIQUE,
    purchase_return_id  INTEGER NOT NULL REFERENCES purchase_returns(id),
    supplier_id         INTEGER NOT NULL REFERENCES suppliers(id),
    amount              NUMERIC(12,2) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'outstanding'
                          CHECK (status IN ('outstanding','adjusted','cancelled')),
    adjusted_in_purchase_id  INTEGER REFERENCES purchases(id),
    notes               TEXT,
    created_by          INTEGER REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debit_notes_supplier ON supplier_debit_notes(supplier_id);
CREATE INDEX IF NOT EXISTS idx_debit_notes_return ON supplier_debit_notes(purchase_return_id);
CREATE INDEX IF NOT EXISTS idx_debit_notes_outstanding ON supplier_debit_notes(supplier_id)
    WHERE status = 'outstanding';

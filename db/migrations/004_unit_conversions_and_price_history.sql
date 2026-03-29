-- ============================================================================
-- Migration 004: Unit Conversions, Price History, Product-Supplier Linking
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- PRODUCT UNIT CONVERSIONS
-- e.g. 1 carton = 6 pieces, 1 dozen = 12 pieces
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_unit_conversions (
    id                SERIAL PRIMARY KEY,
    product_id        INTEGER NOT NULL REFERENCES products(id),
    unit_name         VARCHAR(30) NOT NULL,
    conversion_value  NUMERIC(12,4) NOT NULL,  -- 1 of this unit = X base units
    is_purchase_unit  BOOLEAN NOT NULL DEFAULT false,
    is_sales_unit     BOOLEAN NOT NULL DEFAULT false,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(product_id, unit_name)
);

CREATE INDEX IF NOT EXISTS idx_unit_conv_product ON product_unit_conversions(product_id);

-- ────────────────────────────────────────────────────────────────────────────
-- PRODUCT PRICE HISTORY
-- Tracks every price change with effective date ranges
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_price_history (
    id                SERIAL PRIMARY KEY,
    product_id        INTEGER NOT NULL REFERENCES products(id),
    effective_from    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to      TIMESTAMPTZ,              -- NULL = current price
    purchase_price    NUMERIC(12,2),
    wholesale_price   NUMERIC(12,2),
    mrp               NUMERIC(12,2),
    changed_by        INTEGER REFERENCES users(id),
    source            VARCHAR(20) NOT NULL DEFAULT 'manual'
                        CHECK (source IN ('manual','billing','purchase')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_product ON product_price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_current ON product_price_history(product_id)
    WHERE effective_to IS NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- PRODUCT ↔ SUPPLIER LINKING
-- Which suppliers supply which products, with last known price
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_suppliers (
    id                    SERIAL PRIMARY KEY,
    product_id            INTEGER NOT NULL REFERENCES products(id),
    supplier_id           INTEGER NOT NULL REFERENCES suppliers(id),
    last_price            NUMERIC(12,2),
    last_purchase_date    DATE,
    last_unit             VARCHAR(20),
    is_primary_supplier   BOOLEAN NOT NULL DEFAULT false,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(product_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_product_suppliers_product ON product_suppliers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_supplier ON product_suppliers(supplier_id);

-- ────────────────────────────────────────────────────────────────────────────
-- ADD base_unit COLUMN TO products
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS base_unit VARCHAR(20) DEFAULT 'piece';

-- Backfill: copy existing unit → base_unit for all rows
UPDATE products SET base_unit = unit WHERE base_unit = 'piece' AND unit != 'piece';

-- ADD primary_supplier_id to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS primary_supplier_id INTEGER REFERENCES suppliers(id);

# API Reference

Base URL: `/api`. All endpoints require JWT (`Authorization: Bearer <token>`) except auth and health.

## Response Format

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": "Human-readable message", "code": "MACHINE_CODE" }
```

**Status codes:** 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 404 Not Found, 409 Conflict, 422 Unprocessable Entity, 500 Internal Server Error.

## Auth

| Method | Path | Body/Params | Response |
|--------|------|-------------|----------|
| POST | `/auth/login` | `{ email, password }` | `{ accessToken, user }` + httpOnly refresh cookie |
| POST | `/auth/logout` | — | Clears refresh cookie |
| POST | `/auth/refresh` | (uses httpOnly cookie) | `{ accessToken, user }` |

## Products

| Method | Path | Params/Body | Response |
|--------|------|-------------|----------|
| GET | `/products` | `?category&isActive&lowStockOnly&page&limit` | `{ products[], total }` |
| POST | `/products` | Product fields | `{ id, name, sku, barcode, current_stock }` |
| GET | `/products/:id` | — | Full product object |
| PUT | `/products/:id` | Partial update fields | Updated product object |
| DELETE | `/products/:id` | — | Soft-delete (is_active=false) |
| GET | `/products/search` | `?q=&limit=8` or `?barcode=` | Product array (includes gst_rate, purchase_price, hsn_code) |
| GET | `/products/barcode/:code` | — | Single product or 404 |
| GET | `/products/low-stock` | — | Products where current_stock < min_stock |
| GET | `/products/:id/stock-ledger` | `?from&to&page&limit` | `{ entries[], total }` |
| GET | `/products/:id/price-history` | — | Price history array |
| GET | `/products/:id/suppliers` | — | Linked suppliers array |
| POST | `/products/:id/suppliers` | `{ supplier_id, last_price, is_primary_supplier }` | Upsert result |
| GET | `/products/:id/unit-conversions` | — | Unit conversions array |
| POST | `/products/:id/unit-conversions` | `{ unit_name, conversion_value, is_purchase_unit, is_sales_unit }` | Created conversion |
| DELETE | `/products/unit-conversions/:conversionId` | — | 204 |

## Customers

| Method | Path | Params/Body | Response |
|--------|------|-------------|----------|
| GET | `/customers` | `?type&isActive&page&limit` | `{ customers[], total }` |
| POST | `/customers` | Customer fields | Created customer |
| GET | `/customers/:id` | — | Full customer object |
| PUT | `/customers/:id` | Partial update | Updated customer |
| DELETE | `/customers/:id` | — | Soft-delete |
| GET | `/customers/search` | `?q=` (name/phone prefix) | Customer array |
| GET | `/customers/:id/ledger` | `?from&to&page&limit` | `{ entries[], total }` |
| GET | `/customers/:id/summary` | — | `{ outstanding_balance, total_purchases, ... }` |

## Invoices

| Method | Path | Params/Body | Response |
|--------|------|-------------|----------|
| POST | `/invoices` | See invoice creation payload below | `{ invoice_id, invoice_no, pdf_status }` |
| GET | `/invoices` | `?status&bill_type&customer_id&from&to&page&limit` | `{ invoices[], summary, total }` |
| GET | `/invoices/:id` | — | Full invoice + items + payments + customer info |
| GET | `/invoices/:id/pdf-status` | — | `{ pdf_status, pdf_url }` |
| GET | `/invoices/:id/pdf` | — | 302 redirect to S3 pre-signed URL or file stream |
| POST | `/invoices/:id/regenerate-pdf` | — | `{ message }` |
| POST | `/invoices/:id/return` | `{ items: [{ invoice_item_id, qty_returned, reason }] }` | Return result |

### Invoice Creation Payload
```json
{
  "bill_type": "retail|wholesale|quickbill",
  "customer_id": 123,
  "customer_name_walkin": "Walk-in name",
  "items": [
    {
      "product_id": 1,
      "product_name_snapshot": "Product Name",
      "hsn_snapshot": "1234",
      "qty": 5,
      "unit": "piece",
      "rate": 100.00,
      "discount_pct": 0,
      "gst_pct": 18,
      "cost_price_snapshot": 80.00,
      "alt_qty": null,
      "alt_unit": null,
      "base_qty": 5
    }
  ],
  "amount_paid": 500,
  "payment_modes": [
    { "mode": "cash", "amount": 300 },
    { "mode": "upi", "amount": 200, "reference_no": "UPI123" }
  ],
  "due_date": "2026-05-01"
}
```

## Payments

| Method | Path | Params/Body | Response |
|--------|------|-------------|----------|
| POST | `/payments` | `{ customer_id, invoice_id, amount, mode, reference_no, notes, modes_detail[] }` | Created payment |
| GET | `/payments` | `?customer_id&from&to&page&limit` | `{ payments[], total }` |
| GET | `/payments/invoice/:invoiceId` | — | Payments for that invoice |

## Purchases

| Method | Path | Params/Body | Response |
|--------|------|-------------|----------|
| POST | `/purchases` | `{ supplier_id, items[], ... }` | Created purchase |
| GET | `/purchases` | `?supplier_id&status&page&limit` | `{ purchases[], total }` |
| GET | `/purchases/:id` | — | Full purchase + items |
| POST | `/purchases/:id/returns` | `{ items: [{ product_id, qty_returned, unit_price, reason }] }` | Return + debit note |
| GET | `/purchases/:id/returns` | — | Returns for that purchase |

## Suppliers

| Method | Path | Params/Body | Response |
|--------|------|-------------|----------|
| POST | `/suppliers` | Supplier fields | Created supplier |
| GET | `/suppliers` | `?isActive&page&limit` | `{ suppliers[], total }` |
| GET | `/suppliers/:id` | — | Full supplier |
| PUT | `/suppliers/:id` | Partial update | Updated supplier |
| GET | `/suppliers/:id/products` | — | Products linked to supplier |
| GET | `/suppliers/:id/debit-notes` | — | Debit notes for supplier |

## Dashboard

| Method | Path | Response |
|--------|------|----------|
| GET | `/dashboard/summary` | `{ today_sales, month_sales, total_customers, low_stock_count, ... }` |
| GET | `/dashboard/sales-overview` | Daily sales for last 30 days |
| GET | `/dashboard/overdue-invoices` | Unpaid/partial invoices |
| GET | `/dashboard/overdue-customers` | Customers with outstanding > 0 |
| GET | `/dashboard/recent-activity` | Latest invoices + payments |
| GET | `/dashboard/payment-modes` | Payment mode breakdown for current month |

## Reports

All report endpoints support date range filters (`?from=YYYY-MM-DD&to=YYYY-MM-DD`).

| Method | Path | Extra Params | Response |
|--------|------|-------------|----------|
| GET | `/reports/sales` | `?bill_type&customer_id&page&limit` | `{ invoices[], summary, total, page, totalPages }` |
| GET | `/reports/gst` | `?month=YYYY-MM` | `{ invoices[], rate_summary[] }` |
| GET | `/reports/stock` | `?category&lowStockOnly` | `{ products[], summary }` |
| GET | `/reports/stock-movement` | `?productId&movementType&page&limit` | `{ movements[], summary, pagination }` |
| GET | `/reports/customer-dues` | `?overdueOnly&customerType&page&limit` | `{ customers[], pagination }` |
| GET | `/reports/profit` | `?page&limit` | `{ invoices[], summary, pagination }` |
| GET | `/reports/collections` | `?mode&page&limit` | `{ payments[], summary, pagination }` |
| GET | `/reports/product-categories` | — | String array of categories |

## Excel Exports

All return `Content-Disposition: attachment; filename=...xlsx`

| Method | Path | Params |
|--------|------|--------|
| GET | `/reports/sales/export` | Same as sales report |
| GET | `/reports/gst/export` | Same as GST report |
| GET | `/reports/stock/export` | Same as stock report |
| GET | `/reports/stock-movement/export` | Same as stock movement |
| GET | `/reports/customer-dues/export` | Same as customer dues |
| GET | `/reports/profit/export` | Same as profit report |
| GET | `/reports/collections/export` | Same as collections |
| GET | `/reports/full-export` | — | Multi-sheet: Customers, Products, Invoices, Items, Payments, Ledger |

## Settings

| Method | Path | Response |
|--------|------|----------|
| GET | `/settings` | Key-value settings object |

## Health

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/health` | `{ success: true, message: 'Hardware ERP API is running' }` |

## Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| INSUFFICIENT_STOCK | 422 | Stock check failed (includes `failures` array) |
| DUPLICATE_SKU | 409 | SKU already exists |
| DUPLICATE_BARCODE | 409 | Barcode already exists |
| DUPLICATE_PHONE | 409 | Phone number already exists |
| INVOICE_NOT_FOUND | 404 | Invoice ID not found |
| PRODUCT_NOT_FOUND | 404 | Product ID not found |
| CUSTOMER_NOT_FOUND | 404 | Customer ID not found |
| PDF_NOT_READY | 202 | PDF still generating |
| NO_FIELDS | 422 | No valid fields in update request |

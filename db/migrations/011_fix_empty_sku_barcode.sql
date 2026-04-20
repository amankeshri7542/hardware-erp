-- Fix empty string SKU/barcode to NULL (empty strings collide on unique constraint)
UPDATE products SET sku = NULL WHERE sku = '';
UPDATE products SET barcode = NULL WHERE barcode = '';

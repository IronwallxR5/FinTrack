-- Migration: Add receipt attachment support to transactions
-- receipt_url stores the server-relative path to the uploaded file,
-- e.g. /uploads/receipts/uuid-filename.jpg
-- NULL means no receipt has been uploaded for this transaction.

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS receipt_url VARCHAR(500) DEFAULT NULL;

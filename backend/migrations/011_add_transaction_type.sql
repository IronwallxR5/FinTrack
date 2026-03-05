-- ============================================================
-- Add a "type" column directly on transactions so every row
-- (including uncategorised ones) knows whether it is income
-- or expense. Previously only the linked category carried this
-- information, leaving uncategorised transactions invisible on
-- the dashboard and in budget calculations.
-- ============================================================

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS type VARCHAR(7);

UPDATE transactions t
SET    type = c.type
FROM   categories c
WHERE  c.id = t.category_id
  AND  t.type IS NULL;

UPDATE transactions SET type = 'expense' WHERE type IS NULL;

ALTER TABLE transactions ALTER COLUMN type SET NOT NULL;
ALTER TABLE transactions ALTER COLUMN type SET DEFAULT 'expense';

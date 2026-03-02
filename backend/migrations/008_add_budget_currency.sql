-- Migration: Add currency support to budgets
-- Each budget now tracks which currency its monthly_limit is denominated in.
-- spent_this_month is summed only from transactions with the same currency.

ALTER TABLE budgets ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'INR';
UPDATE budgets b
SET    currency = u.preferred_currency
FROM   users u
WHERE  b.user_id = u.id;

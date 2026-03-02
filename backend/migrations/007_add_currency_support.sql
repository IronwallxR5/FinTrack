-- Migration: Add currency support
-- Each transaction stores the currency it was entered in.
-- Each user has a preferred (default) currency for display and reports.

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'INR';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(3) NOT NULL DEFAULT 'INR';

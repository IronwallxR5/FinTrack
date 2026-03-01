-- Migration: Create budgets table
-- Description: Monthly spending limits per expense category per user

CREATE TABLE IF NOT EXISTS budgets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id     UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    monthly_limit   NUMERIC(12, 2) NOT NULL CHECK (monthly_limit > 0),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_user_category
    ON budgets (user_id, category_id);

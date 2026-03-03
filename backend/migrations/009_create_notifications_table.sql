-- Migration: Create notifications table
-- Stores in-app and email notifications for budget threshold events.
-- type: 'budget_warning' (≥80%) | 'budget_exceeded' (≥100%)
-- Unique constraint prevents duplicate alerts per budget per type per month.

CREATE TABLE IF NOT EXISTS notifications (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    budget_id    UUID REFERENCES budgets(id) ON DELETE CASCADE,
    type         VARCHAR(50)  NOT NULL,
    title        VARCHAR(255) NOT NULL,
    message      TEXT         NOT NULL,
    is_read      BOOLEAN      NOT NULL DEFAULT FALSE,
    month        INTEGER      NOT NULL, 
    year         INTEGER      NOT NULL,
    created_at   TIMESTAMP    DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_budget_type_month
    ON notifications (budget_id, type, month, year)
    WHERE budget_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications (user_id, is_read, created_at DESC);

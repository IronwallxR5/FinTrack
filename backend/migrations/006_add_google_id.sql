-- Migration: Add google_id column for Google OAuth
-- Allows users to sign in with Google without a password

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

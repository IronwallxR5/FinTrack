-- Migration: Add name column to users table for profile management
-- Description: Allows users to manage their profile (name)

ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(100);

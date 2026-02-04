-- Migration: Add username column to users table
-- Date: 2026-02-04
-- Description: Add unique username field for user profiles and search

-- Add username column (nullable, unique)
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Note: The column is nullable to support existing users
-- Users can set their username through the settings page

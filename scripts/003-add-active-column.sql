-- Add active column to users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

-- Set all existing users to active by default
UPDATE users SET active = TRUE WHERE active IS NULL;

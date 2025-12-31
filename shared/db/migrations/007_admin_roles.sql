-- Admin roles and user status management
-- Adds roles array and is_active flag for admin user management

-- Add roles array column (supports multiple roles per user)
-- Common roles: 'admin', future: 'moderator', 'editor', etc.
ALTER TABLE users ADD COLUMN roles TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Add is_active flag for soft deactivation (default to true)
ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Add deactivated_at timestamp
ALTER TABLE users ADD COLUMN deactivated_at TIMESTAMPTZ;

-- Index for common admin queries
CREATE INDEX idx_users_roles ON users USING GIN (roles);
CREATE INDEX idx_users_is_active ON users(is_active);

-- Update existing admin user if exists (from seed)
-- This is a no-op if no admin user exists
UPDATE users SET roles = ARRAY['admin'] WHERE username = 'admin';

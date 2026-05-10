-- Migration: Initial schema
-- Date: 2024-01-01
-- Description: Create initial database schema

BEGIN;

-- Run the main schema file
\i schema.sql

-- Insert default data
INSERT INTO users (email, password, username, display_name, is_verified, is_creator)
VALUES 
    ('admin@nexora.com', '$2b$10$placeholder_hash', 'nexora_admin', 'Nexora Admin', TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

COMMIT;

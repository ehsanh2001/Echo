-- ============================================================================
-- Echo Database Cleanup Script
-- ============================================================================
-- This script cleans all data from all Echo service databases
-- Run this script to reset databases to a clean state for testing
--
-- Usage: psql -U postgres -f cleanup.sql
-- ============================================================================

-- Connect to users_db and clean all tables
\c users_db

-- Disable foreign key checks temporarily (PostgreSQL doesn't have this, we'll use CASCADE)
-- Clean users table
TRUNCATE TABLE users RESTART IDENTITY CASCADE;

\echo '✅ users_db cleaned'

-- ============================================================================

-- Connect to workspace_channels_db and clean all tables
\c workspace_channels_db

-- Clean tables in correct order (children first, then parents)
-- Note: Using CASCADE will handle foreign key constraints automatically

-- Clean child tables first
TRUNCATE TABLE channel_members RESTART IDENTITY CASCADE;
TRUNCATE TABLE invites RESTART IDENTITY CASCADE;
TRUNCATE TABLE audit_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE outbox_events RESTART IDENTITY CASCADE;
TRUNCATE TABLE workspace_members RESTART IDENTITY CASCADE;

-- Clean parent tables
TRUNCATE TABLE channels RESTART IDENTITY CASCADE;
TRUNCATE TABLE workspaces RESTART IDENTITY CASCADE;

\echo '✅ workspace_channels_db cleaned'

-- ============================================================================

-- Connect to message_db and clean all tables
\c message_db

-- Clean tables in correct order (children first, then parents)

-- Clean child tables first
TRUNCATE TABLE message_reactions RESTART IDENTITY CASCADE;
TRUNCATE TABLE message_mentions RESTART IDENTITY CASCADE;
TRUNCATE TABLE message_attachments RESTART IDENTITY CASCADE;
TRUNCATE TABLE channel_read_receipts RESTART IDENTITY CASCADE;
TRUNCATE TABLE thread_metadata RESTART IDENTITY CASCADE;
TRUNCATE TABLE archived_messages_index RESTART IDENTITY CASCADE;

-- Clean parent tables
TRUNCATE TABLE messages RESTART IDENTITY CASCADE;
TRUNCATE TABLE channel_sequences RESTART IDENTITY CASCADE;

\echo '✅ messages_db cleaned'

-- ============================================================================

\echo ''
\echo '🎉 All Echo databases have been cleaned successfully!'
\echo ''
\echo 'Databases cleaned:'
\echo '  - users_db (1 table)'
\echo '  - workspaces_channels_db (7 tables)'
\echo '  - messages_db (8 tables)'
\echo ''

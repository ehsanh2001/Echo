-- init-databases.sql
-- Creates all required databases for Echo services
-- This script runs automatically when PostgreSQL container starts for the first time

-- =============================================================================
-- Create Databases
-- =============================================================================

-- Database for user-service (authentication, user profiles, password reset)
CREATE DATABASE users_db;

-- Database for workspace-channel-service (workspaces, channels, memberships)
CREATE DATABASE workspace_channels_db;

-- Database for message-service (messages, threads, reactions, mentions)
CREATE DATABASE message_db;

-- =============================================================================
-- Grant Privileges
-- =============================================================================
-- All databases use the same postgres user for simplicity in local development
-- In production, each service should have its own database user

GRANT ALL PRIVILEGES ON DATABASE users_db TO postgres;
GRANT ALL PRIVILEGES ON DATABASE workspace_channels_db TO postgres;
GRANT ALL PRIVILEGES ON DATABASE message_db TO postgres;

-- =============================================================================
-- Verification
-- =============================================================================
-- List all databases (for logging purposes)
\l

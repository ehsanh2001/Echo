#!/bin/bash
# =============================================================================
# PostgreSQL Multiple Database Creation Script
# =============================================================================
# This script is automatically run by PostgreSQL on first container start.
# It creates the three databases needed by Echo services plus test databases.
# =============================================================================

set -e
set -u

function create_database() {
    local database=$1
    echo "Creating database '$database'..."
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
        SELECT 'CREATE DATABASE $database'
        WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$database')\gexec
        GRANT ALL PRIVILEGES ON DATABASE $database TO $POSTGRES_USER;
EOSQL
    echo "Database '$database' created successfully."
}

echo "=============================================="
echo "Creating Echo databases..."
echo "=============================================="

# Create production databases
create_database "users_db"
create_database "workspace_channels_db"
create_database "message_db"

echo ""
echo "=============================================="
echo "Creating test databases..."
echo "=============================================="

# Create test databases (for unit and integration tests)
create_database "users_db_test"
create_database "workspace_channels_db_test"
create_database "message_db_test"

echo ""
echo "=============================================="
echo "All databases created successfully!"
echo "=============================================="

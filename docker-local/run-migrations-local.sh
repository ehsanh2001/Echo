#!/bin/bash
# =============================================================================
# Run Prisma Migrations for Local Development
# =============================================================================
# This script runs Prisma migrations for all service databases including test DBs.
# Run this after starting the local docker-compose with PostgreSQL.
#
# Usage: ./scripts/run-migrations-local.sh
# =============================================================================

set -e

# Configuration - can be overridden by environment variables
POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
POSTGRES_USER=${POSTGRES_USER:-postgres}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}

# Database names
USERS_DB_NAME=${USERS_DB_NAME:-users_db}
WORKSPACE_CHANNELS_DB_NAME=${WORKSPACE_CHANNELS_DB_NAME:-workspace_channels_db}
MESSAGE_DB_NAME=${MESSAGE_DB_NAME:-message_db}

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================="
echo "Local Database Migration Script"
echo "=========================================="
echo "Host: $POSTGRES_HOST:$POSTGRES_PORT"
echo "User: $POSTGRES_USER"
echo "Project: $PROJECT_ROOT"
echo "=========================================="

# Wait for PostgreSQL to be ready
echo ""
echo "Waiting for PostgreSQL to be ready..."
until PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -c '\q' 2>/dev/null; do
  echo "PostgreSQL is not ready yet. Waiting..."
  sleep 2
done
echo "PostgreSQL is ready!"

# Function to run migration for a service
run_migration() {
  local service_name=$1
  local db_name=$2
  local service_dir=$3
  
  echo ""
  echo "----------------------------------------"
  echo "Running migrations for: $service_name"
  echo "Database: $db_name"
  echo "----------------------------------------"
  
  cd "$PROJECT_ROOT/$service_dir"
  
  # Set DATABASE_URL for this service
  export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${db_name}"
  
  # Run Prisma migrations
  npx prisma migrate deploy
  
  echo "✅ $service_name migrations completed!"
}

# Function to apply SQL function to a database
apply_sql_function() {
  local db_name=$1
  local sql_file=$2
  
  echo "Applying SQL function to $db_name..."
  PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$db_name" -f "$sql_file"
  echo "✅ SQL function applied to $db_name!"
}

echo ""
echo "=========================================="
echo "Running PRODUCTION database migrations..."
echo "=========================================="

# Run migrations for production databases
run_migration "user-service" "$USERS_DB_NAME" "services/user-service"
run_migration "workspace-channel-service" "$WORKSPACE_CHANNELS_DB_NAME" "services/workspace-channel-service"
run_migration "message-service" "$MESSAGE_DB_NAME" "services/message-service"

# Apply SQL function for message-service (production)
echo ""
echo "----------------------------------------"
echo "Creating get_next_message_no function (production)..."
echo "----------------------------------------"
apply_sql_function "$MESSAGE_DB_NAME" "$PROJECT_ROOT/services/message-service/prisma/migrations/get_next_message_no_function.sql"

echo ""
echo "=========================================="
echo "Running TEST database migrations..."
echo "=========================================="

# Run migrations for test databases
run_migration "user-service (test)" "${USERS_DB_NAME}_test" "services/user-service"
run_migration "workspace-channel-service (test)" "${WORKSPACE_CHANNELS_DB_NAME}_test" "services/workspace-channel-service"
run_migration "message-service (test)" "${MESSAGE_DB_NAME}_test" "services/message-service"

# Apply SQL function for message-service (test)
echo ""
echo "----------------------------------------"
echo "Creating get_next_message_no function (test)..."
echo "----------------------------------------"
apply_sql_function "${MESSAGE_DB_NAME}_test" "$PROJECT_ROOT/services/message-service/prisma/migrations/get_next_message_no_function.sql"

echo ""
echo "=========================================="
echo "All migrations completed successfully!"
echo "=========================================="
echo ""
echo "Databases ready:"
echo "  - $USERS_DB_NAME (production)"
echo "  - $USERS_DB_NAME_test (test)"
echo "  - $WORKSPACE_CHANNELS_DB_NAME (production)"
echo "  - ${WORKSPACE_CHANNELS_DB_NAME}_test (test)"
echo "  - $MESSAGE_DB_NAME (production)"
echo "  - ${MESSAGE_DB_NAME}_test (test)"
echo ""

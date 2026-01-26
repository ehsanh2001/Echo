#!/bin/sh
# =============================================================================
# Run Prisma Migrations for All Services
# =============================================================================
# This script runs Prisma migrations for each service database.
# It's run by the db-migrate container before services start.
# =============================================================================

set -e

echo "=========================================="
echo "Starting database migrations..."
echo "=========================================="

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER"; do
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
  
  cd /app/$service_dir
  
  # Set DATABASE_URL for this service
  export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${db_name}"
  
  # Run Prisma migrations
  npx prisma migrate deploy
  
  echo "✅ $service_name migrations completed!"
}

# Run migrations for each service
run_migration "user-service" "$USERS_DB_NAME" "services/user-service"
run_migration "workspace-channel-service" "$WORKSPACE_CHANNELS_DB_NAME" "services/workspace-channel-service"
run_migration "message-service" "$MESSAGE_DB_NAME" "services/message-service"

# Run the custom SQL function for message-service
echo ""
echo "----------------------------------------"
echo "Creating get_next_message_no function..."
echo "----------------------------------------"
export PGPASSWORD="$POSTGRES_PASSWORD"
psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$MESSAGE_DB_NAME" -f /app/get_next_message_no_function.sql
echo "✅ SQL function created!"

echo ""
echo "=========================================="
echo "All migrations completed successfully!"
echo "=========================================="

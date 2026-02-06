#!/bin/bash
# =============================================================================
# Run Prisma Migrations for All Services (Host-Side Script)
# =============================================================================
# This script runs on the EC2 host (not inside a container).
# It installs service dependencies, runs Prisma migrations against the
# PostgreSQL container, and applies custom SQL functions.
#
# Prerequisites:
#   - Node.js 22+ installed on the host
#   - PostgreSQL container (echo-postgres) running and healthy
#   - Repository cloned at ~/Echo
#
# Usage:
#   cd ~/Echo/docker-deploy
#   ./run-migrations.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
POSTGRES_CONTAINER="echo-postgres"

# Database configuration (match docker-compose.yml defaults)
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
POSTGRES_HOST="localhost"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

# Database names
USERS_DB="${USERS_DB_NAME:-users_db}"
WORKSPACE_CHANNELS_DB="${WORKSPACE_CHANNELS_DB_NAME:-workspace_channels_db}"
MESSAGE_DB="${MESSAGE_DB_NAME:-message_db}"

echo "=========================================="
echo "Starting database migrations..."
echo "=========================================="

# --------------------------------------------------
# Step 1: Wait for PostgreSQL container to be healthy
# --------------------------------------------------
echo ""
echo "Waiting for PostgreSQL container to be healthy..."
until docker exec "$POSTGRES_CONTAINER" pg_isready -U "$POSTGRES_USER" > /dev/null 2>&1; do
  echo "  PostgreSQL is not ready yet. Waiting..."
  sleep 2
done
echo "✅ PostgreSQL is ready!"

# --------------------------------------------------
# Step 2: Ensure databases exist
# --------------------------------------------------
echo ""
echo "----------------------------------------"
echo "Verifying databases exist..."
echo "----------------------------------------"
for db in "$USERS_DB" "$WORKSPACE_CHANNELS_DB" "$MESSAGE_DB"; do
  EXISTS=$(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" 2>/dev/null)
  if [ "$EXISTS" = "1" ]; then
    echo "  ✅ Database '$db' exists"
  else
    echo "  ⚠️  Database '$db' not found — creating..."
    docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -c "CREATE DATABASE $db;"
    echo "  ✅ Database '$db' created"
  fi
done

# --------------------------------------------------
# Step 3: Run Prisma migrations for each service
# --------------------------------------------------
run_migration() {
  local service_name=$1
  local db_name=$2
  local service_dir=$3

  echo ""
  echo "----------------------------------------"
  echo "Running migrations for: $service_name"
  echo "  Database: $db_name"
  echo "  Directory: $service_dir"
  echo "----------------------------------------"

  cd "$REPO_ROOT/$service_dir"

  # Install dependencies (needed for Prisma CLI and @prisma/client)
  echo "  Installing dependencies..."
  npm install --omit=dev --ignore-scripts 2>&1 | tail -1
  npx prisma generate 2>&1 | tail -1

  # Build DATABASE_URL pointing to the container's mapped port or internal network
  export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${db_name}"

  # Run Prisma migrations
  echo "  Applying migrations..."
  npx prisma migrate deploy

  echo "  ✅ $service_name migrations completed!"
}

run_migration "user-service" "$USERS_DB" "services/user-service"
run_migration "workspace-channel-service" "$WORKSPACE_CHANNELS_DB" "services/workspace-channel-service"
run_migration "message-service" "$MESSAGE_DB" "services/message-service"

# --------------------------------------------------
# Step 4: Apply custom SQL functions
# --------------------------------------------------
echo ""
echo "----------------------------------------"
echo "Applying get_next_message_no function..."
echo "----------------------------------------"
docker exec -i "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$MESSAGE_DB" \
  < "$REPO_ROOT/services/message-service/prisma/migrations/get_next_message_no_function.sql"
echo "✅ SQL function created!"

# --------------------------------------------------
# Step 5: Verify everything
# --------------------------------------------------
echo ""
echo "=========================================="
echo "Verifying migration results..."
echo "=========================================="

echo ""
echo "--- Tables in $USERS_DB ---"
docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$USERS_DB" -c "\dt" 2>/dev/null

echo ""
echo "--- Tables in $WORKSPACE_CHANNELS_DB ---"
docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$WORKSPACE_CHANNELS_DB" -c "\dt" 2>/dev/null

echo ""
echo "--- Tables in $MESSAGE_DB ---"
docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$MESSAGE_DB" -c "\dt" 2>/dev/null

echo ""
echo "--- Functions in $MESSAGE_DB ---"
docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$MESSAGE_DB" -c "\df get_next_message_no" 2>/dev/null

echo ""
echo "=========================================="
echo "✅ All migrations completed successfully!"
echo "=========================================="

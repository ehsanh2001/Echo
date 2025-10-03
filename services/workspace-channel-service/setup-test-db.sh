#!/bin/bash

# Set up test database for workspace channels service

DB_NAME="workspace_channels_db_test"
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_HOST="localhost"
DB_PORT="5432"

echo "Setting up test database $DB_NAME..."

# Check if PostgreSQL is running
if ! pg_isready -h $DB_HOST -p $DB_PORT; then
    echo "Error: PostgreSQL is not running on $DB_HOST:$DB_PORT"
    exit 1
fi

# Drop test database if it exists and recreate
dropdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME 2>/dev/null || true
createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME

echo "Test database $DB_NAME setup complete!"

# Run migrations on test database
echo "Running Prisma migrations on test database..."
NODE_ENV=test npx prisma migrate dev --name init

echo "Test database setup complete!"
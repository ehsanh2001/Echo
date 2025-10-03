#!/bin/bash

# Set up workspace channels database

DB_NAME="workspace_channels_db"
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_HOST="localhost"
DB_PORT="5432"

echo "Setting up $DB_NAME database..."

# Check if PostgreSQL is running
if ! pg_isready -h $DB_HOST -p $DB_PORT; then
    echo "Error: PostgreSQL is not running on $DB_HOST:$DB_PORT"
    exit 1
fi

# Create database if it doesn't exist
createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME 2>/dev/null || true

echo "Database $DB_NAME setup complete!"

# Run migrations
echo "Running Prisma migrations..."
npx prisma migrate dev --name init

echo "Generating Prisma client..."
npx prisma generate

echo "Setup complete!"
#!/bin/bash

# User Service Database Setup Script
# Creates the users_db database for the User Service using local PostgreSQL

set -e

POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
POSTGRES_USER=${POSTGRES_USER:-postgres}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}
POSTGRES_DB=${POSTGRES_DB:-postgres}

echo "🔄 Setting up User Service database..."

# Create the users_db database if it doesn't exist
echo "🏗️ Creating users_db database..."
PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -c "CREATE DATABASE users_db;" 2>/dev/null || echo "ℹ️ Database users_db may already exist"

echo "✅ User Service database setup complete!"
echo "📊 Database: users_db"
echo "🔌 Connection: postgresql://$POSTGRES_USER:***@$POSTGRES_HOST:$POSTGRES_PORT/users_db"
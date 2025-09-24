#!/bin/bash

# Test Database Setup Script
echo "🔧 Setting up test database..."

# Set test environment
export NODE_ENV=test

# Create test database if it doesn't exist
echo "📊 Creating test database..."
createdb users_db_test 2>/dev/null || echo "Database already exists"

# Run Prisma migrations on test database
echo "🚀 Running migrations on test database..."
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/users_db_test"
npx prisma migrate reset
npx prisma db push

# Generate Prisma client
echo "⚡ Generating Prisma client..."
npx prisma generate

echo "✅ Test database setup complete!"
echo "🧪 You can now run tests with: npm test"
#!/bin/bash

# Test Database Setup Script
echo "🔧 Setting up test database..."

# Set test environment
export NODE_ENV=test

# Create test database if it doesn't exist
echo "📊 Creating test database..."
createdb echo_user_service_test 2>/dev/null || echo "Database already exists"

# Run Prisma migrations on test database
echo "🚀 Running migrations on test database..."
export DATABASE_URL="postgresql://postgres:password@localhost:5432/echo_user_service_test"
npx prisma migrate deploy

# Generate Prisma client
echo "⚡ Generating Prisma client..."
npx prisma generate

echo "✅ Test database setup complete!"
echo "🧪 You can now run tests with: npm test"
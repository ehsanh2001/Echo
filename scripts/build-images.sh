#!/bin/bash

# Echo - Build all Docker images script

set -e

echo "🏗️ Building Echo Docker images..."

# Build API Gateway
echo "Building API Gateway..."
docker build -t echo/api-gateway:latest ./services/api-gateway

# Build User Service  
echo "Building User Service..."
docker build -t echo/user-service:latest ./services/user-service

# Build Message Service
echo "Building Message Service..."
docker build -t echo/message-service:latest ./services/message-service

# Build AI Service
echo "Building AI Service..."
docker build -t echo/ai-service:latest ./services/ai-service

# Build Frontend
echo "Building Frontend..."
docker build -t echo/frontend:latest ./frontend

echo "✅ All images built successfully!"

# List built images
echo "📦 Built images:"
docker images | grep echo
#!/bin/bash
# =============================================================================
# Echo Demo Deployment Script
# =============================================================================
# Quick deployment script for EC2 instance.
# Usage: ./deploy.sh
# =============================================================================

set -e

echo "=========================================="
echo "Echo Demo Deployment"
echo "=========================================="

# Check required environment variables
check_env() {
    local var_name=$1
    if [ -z "${!var_name}" ]; then
        echo "❌ Error: $var_name is not set"
        echo "Please set it: export $var_name=<value>"
        exit 1
    fi
    echo "✅ $var_name is set"
}

echo ""
echo "Checking required environment variables..."
check_env "JWT_SECRET"
check_env "GMAIL_USER"
check_env "GMAIL_APP_PASSWORD"
check_env "EC2_PUBLIC_IP"

echo ""
echo "All required environment variables are set!"
echo ""

# Stop existing containers
echo "Stopping existing containers..."
docker-compose down 2>/dev/null || true

# Pull latest images
echo ""
echo "Pulling latest images from Docker Hub..."
docker-compose pull

# Start services
echo ""
echo "Starting services..."
docker-compose up -d

echo ""
echo "Waiting for services to be healthy..."
sleep 10

# Show status
echo ""
echo "Service Status:"
docker-compose ps

echo ""
echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "Access the application at: http://${EC2_PUBLIC_IP}"
echo ""
echo "Useful commands:"
echo "  View logs:    docker-compose logs -f"
echo "  Stop:         docker-compose down"
echo "  Restart:      docker-compose restart"
echo ""

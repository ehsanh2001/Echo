#!/bin/bash
# =============================================================================
# build-and-push.sh - Build and push all Docker images to Docker Hub
# =============================================================================
# Usage:
#   ./build-and-push.sh              # Build and push all services
#   ./build-and-push.sh --build-only # Build without pushing
#   ./build-and-push.sh --push-only  # Push pre-built images (assumes latest tag)
#   ./build-and-push.sh frontend     # Build and push specific service
#
# Prerequisites:
#   - Docker installed and running
#   - Docker Hub login: docker login -u ehosseinipbox
# =============================================================================

set -e

# Configuration
DOCKER_HUB_USERNAME="ehosseinipbox"
TAG="latest"

# Service mappings: local_name -> docker_hub_repo_suffix
declare -A SERVICES=(
    ["frontend"]="echo-frontend"
    ["bff-service"]="echo-bff"
    ["user-service"]="echo-user"
    ["workspace-channel-service"]="echo-workspace-channel"
    ["message-service"]="echo-message"
    ["notification-service"]="echo-notification"
)

# Dockerfile contexts and paths
declare -A CONTEXTS=(
    ["frontend"]="frontend"
    ["bff-service"]="."
    ["user-service"]="."
    ["workspace-channel-service"]="."
    ["message-service"]="."
    ["notification-service"]="."
)

declare -A DOCKERFILES=(
    ["frontend"]="frontend/Dockerfile"
    ["bff-service"]="services/bff-service/Dockerfile"
    ["user-service"]="services/user-service/Dockerfile"
    ["workspace-channel-service"]="services/workspace-channel-service/Dockerfile"
    ["message-service"]="services/message-service/Dockerfile"
    ["notification-service"]="services/notification-service/Dockerfile"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory and echo project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ECHO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Flags
BUILD=true
PUSH=true
SPECIFIC_SERVICE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --build-only)
            PUSH=false
            shift
            ;;
        --push-only)
            BUILD=false
            shift
            ;;
        --tag)
            TAG="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS] [SERVICE]"
            echo ""
            echo "Options:"
            echo "  --build-only    Build images without pushing"
            echo "  --push-only     Push pre-built images (assumes they exist)"
            echo "  --tag TAG       Use specific tag (default: latest)"
            echo "  -h, --help      Show this help message"
            echo ""
            echo "Services:"
            echo "  frontend, bff-service, user-service,"
            echo "  workspace-channel-service, message-service, notification-service"
            echo ""
            echo "Examples:"
            echo "  $0                          # Build and push all services"
            echo "  $0 frontend                 # Build and push frontend only"
            echo "  $0 --build-only             # Build all without pushing"
            echo "  $0 --tag v1.0.0 frontend    # Build frontend with v1.0.0 tag"
            exit 0
            ;;
        *)
            SPECIFIC_SERVICE="$1"
            shift
            ;;
    esac
done

# Print banner
echo -e "${BLUE}"
echo "=============================================="
echo "  Echo - Docker Image Build & Push"
echo "=============================================="
echo -e "${NC}"
echo "Docker Hub: ${DOCKER_HUB_USERNAME}"
echo "Tag: ${TAG}"
echo "Build: ${BUILD}"
echo "Push: ${PUSH}"
echo ""

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    exit 1
fi

# Check Docker Hub login if pushing
if [ "$PUSH" = true ]; then
    if ! docker info 2>/dev/null | grep -q "Username"; then
        echo -e "${YELLOW}Warning: Not logged into Docker Hub${NC}"
        echo "Run: docker login -u ${DOCKER_HUB_USERNAME}"
        echo ""
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi

# Change to echo directory
cd "$ECHO_DIR"
echo "Working directory: $(pwd)"
echo ""

# Build and push function
build_and_push() {
    local service=$1
    local repo="${SERVICES[$service]}"
    local context="${CONTEXTS[$service]}"
    local dockerfile="${DOCKERFILES[$service]}"
    local full_image="${DOCKER_HUB_USERNAME}/${repo}:${TAG}"

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  ${service}${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "Image: ${full_image}"
    echo ""

    if [ "$BUILD" = true ]; then
        echo -e "${YELLOW}Building...${NC}"
        
        # Special handling for frontend (needs build args)
        if [ "$service" = "frontend" ]; then
            docker build \
                --build-arg NEXT_PUBLIC_API_URL=http://localhost:8004 \
                --build-arg NEXT_PUBLIC_BFF_URL=http://localhost:8004 \
                --build-arg NEXT_PUBLIC_APP_NAME=Echo \
                --build-arg NEXT_PUBLIC_MAX_MESSAGE_LENGTH=5000 \
                --build-arg NEXT_PUBLIC_APP_VERSION=1.0.0 \
                --build-arg NEXT_PUBLIC_APP_ENVIRONMENT=production \
                -t "$full_image" \
                -f "$dockerfile" \
                "$context"
        else
            docker build \
                -t "$full_image" \
                -f "$dockerfile" \
                "$context"
        fi
        
        echo -e "${GREEN}✓ Build complete${NC}"
    fi

    if [ "$PUSH" = true ]; then
        echo -e "${YELLOW}Pushing...${NC}"
        docker push "$full_image"
        echo -e "${GREEN}✓ Push complete${NC}"
    fi

    echo ""
}

# Determine which services to build
if [ -n "$SPECIFIC_SERVICE" ]; then
    if [ -z "${SERVICES[$SPECIFIC_SERVICE]}" ]; then
        echo -e "${RED}Error: Unknown service '${SPECIFIC_SERVICE}'${NC}"
        echo "Available services: ${!SERVICES[*]}"
        exit 1
    fi
    SERVICES_TO_BUILD=("$SPECIFIC_SERVICE")
else
    SERVICES_TO_BUILD=("user-service" "workspace-channel-service" "message-service" "notification-service" "bff-service" "frontend")
fi

# Build and push services
echo "Services to process: ${SERVICES_TO_BUILD[*]}"
echo ""

for service in "${SERVICES_TO_BUILD[@]}"; do
    build_and_push "$service"
done

# Summary
echo -e "${GREEN}=============================================="
echo "  Complete!"
echo "==============================================${NC}"
echo ""
echo "Images:"
for service in "${SERVICES_TO_BUILD[@]}"; do
    repo="${SERVICES[$service]}"
    echo "  - ${DOCKER_HUB_USERNAME}/${repo}:${TAG}"
done
echo ""

if [ "$PUSH" = true ]; then
    echo "To pull these images:"
    echo "  docker pull ${DOCKER_HUB_USERNAME}/echo-frontend:${TAG}"
    echo ""
    echo "To use in Minikube:"
    echo "  kubectl set image deployment/frontend frontend=${DOCKER_HUB_USERNAME}/echo-frontend:${TAG}"
fi

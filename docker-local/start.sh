#!/bin/bash
# =============================================================================
# Echo Local Development - Start Script
# =============================================================================
# This script starts all Docker containers using the project root .env file
# Usage: ./start.sh [docker-compose-args]
# Examples:
#   ./start.sh              # Start all services
#   ./start.sh -d           # Start in detached mode
#   ./start.sh --build      # Rebuild and start
#   ./start.sh logs -f      # Follow logs
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

docker compose --env-file ../.env "$@"

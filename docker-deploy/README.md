# Echo Demo Deployment

Single EC2 instance deployment for the Echo application. Everything runs in Docker containers including PostgreSQL.

## Overview

This deployment setup handles:

- **Infrastructure**: PostgreSQL, Redis, RabbitMQ running in containers
- **Database Initialization**: Automatic creation of 3 databases on first startup
- **Schema Migrations**: Run manually via `run-migrations.sh` before first deployment
- **SQL Functions**: Custom PostgreSQL functions applied by the migration script
- **Application Services**: Pre-built images pulled from Docker Hub
- **Reverse Proxy**: Nginx for routing and WebSocket support

## Requirements

- EC2 instance (t2.micro with 1GB RAM or t3.small with 2GB RAM recommended)
- Docker and Docker Compose installed
- Node.js 22+ installed (for running database migrations)
- Security group allowing inbound traffic on port 80
- Gmail account with App Password for email notifications (optional)

## Quick Start

### 1. Install Docker on EC2

```bash
# Update system
sudo yum update -y  # Amazon Linux
# or
sudo apt update && sudo apt upgrade -y  # Ubuntu

# Install Docker
sudo yum install -y docker  # Amazon Linux
# or
sudo apt install -y docker.io  # Ubuntu

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group (logout/login required after this)
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Node.js 22 (needed for running migrations)
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -  # Amazon Linux
# or
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -  # Ubuntu
sudo yum install -y nodejs  # Amazon Linux
# or
sudo apt install -y nodejs  # Ubuntu
```

### 2. Clone Repository

```bash
git clone <your-repo-url> Echo
cd Echo/docker-deploy
```

### 3. Set Environment Variables

Option A: Create a `.env` file:

```bash
cp .env.example .env
nano .env  # Edit with your values
```

Option B: Export environment variables directly:

```bash
export JWT_SECRET="your-super-secure-jwt-secret-key-at-least-32-characters"
export GMAIL_USER="your-email@gmail.com"
export GMAIL_APP_PASSWORD="your-gmail-app-password"
export EC2_PUBLIC_IP="your-ec2-public-ip"
```

### Gmail App Password Setup (for email notifications)

To send invitation and password reset emails, you need a Gmail App Password:

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Step Verification if not already enabled
3. Go to [App Passwords](https://myaccount.google.com/apppasswords)
4. Select "Mail" and "Other (Custom name)" → Enter "Echo App"
5. Copy the 16-character password (no spaces)
6. Use this as `GMAIL_APP_PASSWORD`

**Note:** If you don't configure Gmail, the app will still work but email notifications (invites, password resets) won't be sent.

### 4. Pull Latest Images

```bash
# Pull pre-built images from Docker Hub
docker-compose pull

# This will download all service images (~500MB total)
```

### 5. First-Time Setup: Run Database Migrations

Before starting application services for the first time, start the infrastructure and run migrations:

```bash
# Start only infrastructure services (PostgreSQL, Redis, RabbitMQ)
docker-compose up -d postgres redis rabbitmq

# Wait for PostgreSQL to be healthy
docker-compose ps  # Verify postgres shows "healthy"

# Run database migrations (creates tables, indexes, SQL functions)
chmod +x run-migrations.sh
./run-migrations.sh
```

The migration script will:
1. Verify all 3 databases exist (creates them if missing)
2. Run Prisma migrations for user-service → user/auth tables
3. Run Prisma migrations for workspace-channel-service → workspace/channel tables
4. Run Prisma migrations for message-service → message/thread tables
5. Apply `get_next_message_no` SQL function for atomic message numbering
6. Print a verification summary of all created tables and functions

### 6. Deploy Application Services

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

**What happens during startup:**

1. **PostgreSQL starts** and runs `init-scripts/create-databases.sh`
   - Creates 3 databases: `users_db`, `workspace_channels_db`, `message_db`
   - Only runs on first startup (data persisted in Docker volume)

2. **Redis & RabbitMQ** start with health checks

3. **Application services** start after infrastructure is healthy
   - Pull pre-built images from Docker Hub
   - Connect to initialized databases (migrations already applied)
   - Begin serving requests

4. **Nginx** starts last and exposes port 80

### 7. Verify Deployment

```bash
# Check all containers are running
docker-compose ps

# Verify databases were created
docker exec -it echo-postgres psql -U postgres -c "\l"

# Expected output should show:
#   users_db
#   workspace_channels_db
#   message_db

# Verify tables were created in each database
docker exec -it echo-postgres psql -U postgres -d users_db -c "\dt"
docker exec -it echo-postgres psql -U postgres -d message_db -c "\dt"

# Verify SQL function was created
docker exec -it echo-postgres psql -U postgres -d message_db -c "\df get_next_message_no"
```

### 8. Access the Application

Open your browser and navigate to:

```
http://<your-ec2-public-ip>
```

## Database Initialization Details

### Automatic Database Creation

On first PostgreSQL startup, the `init-scripts/01-create-databases.sh` script automatically creates:

| Database                | Purpose                                 |
| ----------------------- | --------------------------------------- |
| `users_db`              | User accounts, authentication, sessions |
| `workspace_channels_db` | Workspaces, channels, memberships       |
| `message_db`            | Messages, threads, reactions            |

### Prisma Migrations

The `run-migrations.sh` script runs on the EC2 host and applies Prisma migrations for each service:

```
services/user-service/prisma/migrations/
services/workspace-channel-service/prisma/migrations/
services/message-service/prisma/migrations/
```

Each migration creates the necessary tables, indexes, and constraints.

### Custom SQL Functions

After Prisma migrations, the following SQL function is applied to `message_db`:

- **`get_next_message_no(channel_id)`** - Atomic function for generating sequential message numbers per channel

This function is defined in `services/message-service/prisma/migrations/get_next_message_no_function.sql`.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Nginx (port 80)                      │
│                     Reverse Proxy + Static                  │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         │ /                  │ /api/*            │ /socket.io/*
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│    Frontend     │  │   BFF Service   │  │   BFF Service   │
│    (Next.js)    │  │   (REST API)    │  │   (WebSocket)   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  User Service   │  │ Workspace-Chan  │  │ Message Service │
│                 │  │    Service      │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        PostgreSQL                           │
│              (users_db, workspace_channels_db, message_db)  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│     Redis       │  │    RabbitMQ     │  │  Notification   │
│  (Cache/Pub)    │  │  (Event Bus)    │  │    Service      │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Services & Memory Allocation

| Service               | Memory Limit |
| --------------------- | ------------ |
| PostgreSQL            | 256 MB       |
| Redis                 | 64 MB        |
| RabbitMQ              | 128 MB       |
| User Service          | 128 MB       |
| Workspace-Channel Svc | 128 MB       |
| Message Service       | 128 MB       |
| BFF Service           | 128 MB       |
| Frontend              | 128 MB       |
| Notification Service  | 64 MB        |
| Nginx                 | 32 MB        |
| **Total**             | **~1.2 GB**  |

Note: The total slightly exceeds 1GB. For t2.micro (1GB), consider removing the notification service or reducing limits further. For t3.small (2GB), this configuration works well.

## Startup Order & Dependencies

The services start in this order (managed by Docker Compose health checks):

```
1. postgres          (healthcheck: pg_isready)
   ├── 2. redis          (healthcheck: redis ping)
   ├── 2. rabbitmq       (healthcheck: rabbitmq-diagnostics ping)
   │
   └── 3. user-service
       └── 4. workspace-channel-service
           └── 5. message-service
               └── 6. notification-service
                   └── 7. bff-service
                       └── 8. frontend
                           └── 9. nginx (exposes port 80)
```

> **Note:** Database migrations must be run manually via `./run-migrations.sh`
> before the first deployment. See [Step 5](#5-first-time-setup-run-database-migrations).

## Commands

```bash
# Pull latest images
docker-compose pull

# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs for all services
docker-compose logs -f

# View logs for specific service
docker-compose logs -f bff-service

# Restart a specific service
docker-compose restart user-service

# Restart with latest images
docker-compose pull && docker-compose up -d

# Check resource usage
docker stats

# Run migrations manually (if needed after schema changes)
cd ~/Echo/docker-deploy && ./run-migrations.sh

# Access PostgreSQL
docker exec -it echo-postgres psql -U postgres

# Access Redis CLI
docker exec -it echo-redis redis-cli -a redis123
```

## Troubleshooting

### Services not starting

```bash
# Check logs
docker-compose logs -f

# Check if migrations were applied
docker exec -it echo-postgres psql -U postgres -d users_db -c "\dt"
```

### Migration failures

```bash
# Re-run migrations manually
cd ~/Echo/docker-deploy
./run-migrations.sh

# If you need to reset everything (WARNING: destroys all data)
docker-compose down -v
docker-compose up -d postgres redis rabbitmq
# Wait for postgres to be healthy, then:
./run-migrations.sh
docker-compose up -d
```

### Database connection issues

```bash
# Verify PostgreSQL is running
docker exec -it echo-postgres pg_isready

# Check databases exist
docker exec -it echo-postgres psql -U postgres -c "\l"

# Check tables in a specific database
docker exec -it echo-postgres psql -U postgres -d users_db -c "\dt"

# Check if SQL function exists
docker exec -it echo-postgres psql -U postgres -d message_db -c "\df get_next_message_no"
```

### Database not initialized

If databases weren't created on first startup:

```bash
# Check init script logs
docker-compose logs postgres | grep -i "creating database"

# Manually create databases if needed
docker exec -it echo-postgres psql -U postgres -c "CREATE DATABASE users_db;"
docker exec -it echo-postgres psql -U postgres -c "CREATE DATABASE workspace_channels_db;"
docker exec -it echo-postgres psql -U postgres -c "CREATE DATABASE message_db;"

# Then run migrations
./run-migrations.sh
```

### Out of memory

```bash
# Check memory usage
free -m
docker stats --no-stream

# Reduce memory limits in docker-compose.yml or upgrade instance
```

### WebSocket connection issues

- Ensure security group allows traffic on port 80
- Check nginx logs: `docker-compose logs nginx`
- Verify BFF service is running: `docker-compose logs bff-service`

## Updating

To update to the latest version:

```bash
# Pull latest images from Docker Hub
docker-compose pull

# Restart services with new images
docker-compose up -d

# View logs to ensure everything started correctly
docker-compose logs -f
```

If there are database schema changes:

```bash
# Pull latest code
cd ~/Echo && git pull origin main

# Run migrations
cd docker-deploy
./run-migrations.sh

# Restart services
docker-compose pull
docker-compose up -d
```

## Complete Reset

To completely reset and start fresh (WARNING: destroys all data):

```bash
# Stop and remove all containers + volumes
docker-compose down -v

# Remove any cached images (optional)
docker system prune -a

# Start fresh
docker-compose pull
docker-compose up -d
```

## Building Images Locally (Optional)

The deployment uses pre-built images from Docker Hub. If you need to build images locally:

```bash
# Build individual service
docker build -t ehosseinipbox/echo-user:latest -f ../services/user-service/Dockerfile ..

# Build frontend
docker build -t ehosseinipbox/echo-frontend:latest ../frontend

# Then use docker-compose up -d as normal
```

## Docker Hub Images

This deployment uses the following pre-built images:

- `ehosseinipbox/echo-user:latest` - User Service
- `ehosseinipbox/echo-workspace-channel:latest` - Workspace-Channel Service
- `ehosseinipbox/echo-message:latest` - Message Service
- `ehosseinipbox/echo-bff:latest` - BFF Service
- `ehosseinipbox/echo-notification:latest` - Notification Service
- `ehosseinipbox/echo-frontend:latest` - Frontend (Next.js)

## Security Notes

- Change default passwords in production
- Use a strong JWT_SECRET (at least 32 characters)
- Consider using AWS Secrets Manager for sensitive values
- Add HTTPS with Let's Encrypt for production use
- Restrict security group rules to necessary IPs only

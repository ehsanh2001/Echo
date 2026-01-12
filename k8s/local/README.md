# Echo - Local Kubernetes Development Environment

This directory contains all files needed for running Echo services in a local Minikube Kubernetes cluster.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HOST MACHINE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     DOCKER (docker-compose.infra.yml)               │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────┐  │    │
│  │  │  PostgreSQL  │  │    Redis     │  │  RabbitMQ    │  │MailHog  │  │    │
│  │  │  Port: 5433  │  │  Port: 6379  │  │  Port: 5672  │  │Port:1025│  │    │
│  │  │              │  │              │  │  UI: 15672   │  │UI: 8025 │  │    │
│  │  │  3 Databases │  │  Password    │  │              │  │         │  │    │
│  │  │  - users_db  │  │  protected   │  │  Mgmt UI     │  │  Email  │  │    │
│  │  │  - wc_db     │  │              │  │  enabled     │  │  Test   │  │    │
│  │  │  - msg_db    │  │              │  │              │  │         │  │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └─────────┘  │    │
│  │         │                 │                 │               │       │    │
│  │         └─────────────────┴─────────────────┴───────────────┘       │    │
│  │                            Docker Volumes                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    │ host.minikube.internal                 │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         MINIKUBE CLUSTER                            │    │
│  │  ┌────────────────────────────────────────────────────────────────┐ │    │
│  │  │                    Application Services                        │ │    │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │ │    │
│  │  │  │Frontend │ │  BFF    │ │  User   │ │Workspace│ │ Message │   │ │    │
│  │  │  │ :3000   │ │ :8004   │ │ :8001   │ │ :8002   │ │ :8003   │   │ │    │
│  │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │ │    │
│  │  │                                                                │ │    │
│  │  │                    ┌───────────────────┐                       │ │    │
│  │  │                    │  Notification     │                       │ │    │
│  │  │                    │  :8005            │                       │ │    │
│  │  │                    └───────────────────┘                       │ │    │
│  │  └────────────────────────────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Docker Desktop installed and running
- Minikube installed
- kubectl installed

## Quick Start

### 1. Start Infrastructure Services

```bash
# Navigate to this directory
cd echo/k8s/local

# Start infrastructure (PostgreSQL, Redis, RabbitMQ, MailHog)
docker-compose -f docker-compose.infra.yml up -d

# Verify all services are healthy
docker-compose -f docker-compose.infra.yml ps
```

### 2. Start Minikube

```bash
# Start Minikube with Docker driver
minikube start --driver=docker

# Verify host.minikube.internal is accessible
minikube ssh "ping -c 3 host.minikube.internal"
```

### 3. Run Database Migrations

Before deploying services, run Prisma migrations:

```bash
# From the echo directory
cd ../..

# User Service
cd services/user-service
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/users_db" npx prisma migrate deploy
cd ../..

# Workspace-Channel Service
cd services/workspace-channel-service
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/workspace_channels_db" npx prisma migrate deploy
cd ../..

# Message Service
cd services/message-service
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/message_db" npx prisma migrate deploy
cd ../..
```

### 4. Deploy Application to Minikube

```bash
# Apply Kubernetes manifests (created in later phases)
kubectl apply -f k8s/local/
```

## Service Access

### From Host Machine

| Service             | URL                    | Credentials                   |
| ------------------- | ---------------------- | ----------------------------- |
| PostgreSQL          | localhost:5433         | postgres / postgres           |
| Redis               | localhost:6379         | password: dev-redis-password  |
| RabbitMQ Management | http://localhost:15672 | admin / dev-rabbitmq-password |
| MailHog UI          | http://localhost:8025  | N/A                           |

### From Minikube Pods

| Service    | URL                                                               |
| ---------- | ----------------------------------------------------------------- |
| PostgreSQL | `postgresql://postgres:postgres@host.minikube.internal:5433/<db>` |
| Redis      | `redis://:dev-redis-password@host.minikube.internal:6379`         |
| RabbitMQ   | `amqp://admin:dev-rabbitmq-password@host.minikube.internal:5672`  |
| MailHog    | `smtp://host.minikube.internal:1025`                              |

## Commands Reference

### Infrastructure Management

```bash
# Start all services
docker-compose -f docker-compose.infra.yml up -d

# Stop services (keeps data)
docker-compose -f docker-compose.infra.yml down

# Stop and remove all data (CAUTION!)
docker-compose -f docker-compose.infra.yml down -v

# View logs
docker-compose -f docker-compose.infra.yml logs -f

# View logs for specific service
docker-compose -f docker-compose.infra.yml logs -f postgres

# Restart a service
docker-compose -f docker-compose.infra.yml restart redis
```

### Database Operations

```bash
# Connect to PostgreSQL
docker exec -it echo-k8s-postgres psql -U postgres

# List databases
docker exec -it echo-k8s-postgres psql -U postgres -c "\l"

# Connect to specific database
docker exec -it echo-k8s-postgres psql -U postgres -d users_db
```

### Redis Operations

```bash
# Connect to Redis CLI
docker exec -it echo-k8s-redis redis-cli -a dev-redis-password

# Check Redis info
docker exec -it echo-k8s-redis redis-cli -a dev-redis-password INFO
```

### Minikube Operations

```bash
# Check Minikube status
minikube status

# SSH into Minikube node
minikube ssh

# Test connectivity to host services (from inside Minikube)
minikube ssh "nc -zv host.minikube.internal 5432"
minikube ssh "nc -zv host.minikube.internal 6379"
minikube ssh "nc -zv host.minikube.internal 5672"
```

## Troubleshooting

### Issue: Minikube Cannot Connect to Host Services

**Symptoms:** Connection refused or timeout from pods

**Solutions:**

1. Verify Docker services are running:

   ```bash
   docker-compose -f docker-compose.infra.yml ps
   ```

2. Check host.minikube.internal resolves:

   ```bash
   minikube ssh "ping -c 3 host.minikube.internal"
   ```

3. Verify ports are not blocked by firewall (Windows):
   - Open Windows Defender Firewall
   - Allow Docker Desktop through firewall
   - Ensure ports 5432, 6379, 5672, 1025 are accessible

4. Restart Minikube:
   ```bash
   minikube stop
   minikube start --driver=docker
   ```

### Issue: Databases Not Created

**Symptoms:** `database "users_db" does not exist`

**Solutions:**

1. Check if init script ran:

   ```bash
   docker logs echo-k8s-postgres | grep "CREATE DATABASE"
   ```

2. Manually create databases:

   ```bash
   docker exec -it echo-k8s-postgres psql -U postgres -c "CREATE DATABASE users_db;"
   docker exec -it echo-k8s-postgres psql -U postgres -c "CREATE DATABASE workspace_channels_db;"
   docker exec -it echo-k8s-postgres psql -U postgres -c "CREATE DATABASE message_db;"
   ```

3. Reset PostgreSQL (destroys all data):
   ```bash
   docker-compose -f docker-compose.infra.yml down -v
   docker-compose -f docker-compose.infra.yml up -d
   ```

### Issue: Port Already in Use

**Symptoms:** `Error: bind: address already in use`

**Solutions:**

1. Check what's using the port:

   ```bash
   # Windows PowerShell
   netstat -ano | findstr :5432

   # Linux/Mac
   lsof -i :5432
   ```

2. Use alternative ports in `.env.infra.local`:
   ```bash
   POSTGRES_PORT=5433
   REDIS_PORT=6380
   ```

## Files in This Directory

| File                     | Description                          |
| ------------------------ | ------------------------------------ |
| docker-compose.infra.yml | Infrastructure services for Minikube |
| init-databases.sql       | PostgreSQL initialization script     |
| .env.infra               | Default environment variables        |
| README.md                | This file                            |

## Next Steps

After infrastructure is running:

1. Deploy application services to Minikube (Phase 3)
2. Configure Kubernetes Secrets (Phase 4)
3. Set up Ingress for external access (Phase 5)

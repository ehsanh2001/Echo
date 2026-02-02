# Echo Local Development Environment

This directory contains all files needed to run Echo locally using Docker Compose.

## Quick Start

```bash
# From the docker-local directory
cd docker-local

# Start all services (uses start.sh wrapper)
./start.sh up -d

# Or use docker compose directly with --env-file
docker compose --env-file ../.env up -d

# Run migrations (including test databases)
./run-migrations-local.sh

# View logs
./start.sh logs -f

# Stop all services
./start.sh down
```

## Files

| File                      | Description                                                            |
| ------------------------- | ---------------------------------------------------------------------- |
| `docker-compose.yml`      | Docker Compose configuration for all services                          |
| `start.sh`                | Wrapper script that loads `../.env` automatically                      |
| `.env.docker`             | Docker-specific overrides (hostnames for container networking)         |
| `init-scripts/`           | PostgreSQL initialization scripts (creates databases on first startup) |
| `run-migrations-local.sh` | Runs Prisma migrations for all databases (prod + test)                 |
| `cleanup.sql`             | SQL script to truncate all test database tables                        |

## Environment Variables

All environment variables are defined in the **project root** `echo/.env` file.
The `start.sh` script automatically loads this file using `--env-file ../.env`.

If running docker compose directly, always include the flag:

```bash
docker compose --env-file ../.env <command>
```

## Services Started

### Infrastructure

- **PostgreSQL** (port 5432) - Database server
- **Redis** (port 6379) - Caching and pub/sub
- **RabbitMQ** (ports 5672, 15672) - Message broker
- **MailHog** (ports 1025, 8025) - Email testing

### Application

- **user-service** (port 8001)
- **workspace-channel-service** (port 8002)
- **message-service** (port 8003)
- **bff-service** (port 8004)
- **notification-service** (port 8005)
- **frontend** (port 3000)

### Observability

- **Grafana** (port 3001) - Dashboards
- **Prometheus** (port 9090) - Metrics
- **Loki** (port 3100) - Logs
- **Tempo** (port 3200) - Traces
- **OpenTelemetry Collector** (ports 4317, 4318)
- **Alloy** (port 12345) - Frontend observability

## Databases Created

The `init-scripts/create-databases.sh` automatically creates these databases:

**Production:**

- `users_db`
- `workspace_channels_db`
- `message_db`

**Test:**

- `users_db_test`
- `workspace_channels_db_test`
- `message_db_test`

## Running Tests

After starting the containers and running migrations:

```bash
# From the echo directory
cd ..

# Run unit tests
npm run test:unit --workspace=services/user-service

# Run integration tests (uses *_test databases)
npm run test:integration --workspace=services/user-service
```

## Cleaning Test Data

To reset test databases:

```bash
# Connect to postgres and run cleanup
docker exec -i echo-postgres psql -U postgres < cleanup.sql
```

## Troubleshooting

### Containers won't start

```bash
# Check logs
./start.sh logs

# Rebuild containers
./start.sh build --no-cache
./start.sh up -d
```

### Database not initialized

```bash
# Remove postgres volume and restart
./start.sh down -v
./start.sh up -d postgres
```

### Migrations failed

```bash
# Check migration logs
./start.sh logs db-migrate

# Re-run migrations manually
./run-migrations-local.sh
```

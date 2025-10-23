# Echo API End-to-End Tests

Comprehensive end-to-end API tests for Echo microservices architecture.

## Overview

These tests validate the complete user workflow across all Echo microservices:

1. **User Service** - User signup and authentication
2. **Workspace-Channel Service** - Workspace and channel management
3. **Message Service** - Message creation and management

## Prerequisites

### 1. Running Services

All services must be running via Docker Compose:

```bash
cd /path/to/echo
docker-compose up -d
```

### 2. Database Setup

Ensure all three databases are created and migrated:

- `users_db` (port 5432)
- `workspaces_channels_db` (port 5432)
- `messages_db` (port 5432)

### 3. Service Health Check

Verify all services are healthy:

```bash
# User Service
curl http://localhost:8001/health

# Workspace-Channel Service
curl http://localhost:8002/health

# Message Service
curl http://localhost:8003/health
```

## Installation

```bash
cd system-tests/api-e2e
npm install
```

## Running Tests

### Run all tests

```bash
npm test
```

### Run tests in watch mode

```bash
npm run test:watch
```

### Run tests with verbose output

```bash
npm run test:verbose
```

## Test Workflow

The e2e test validates the following workflow:

```
┌─────────────────────────────────────────────────────────┐
│                   E2E Test Workflow                     │
└─────────────────────────────────────────────────────────┘

Step 1: User Signup
  POST /api/users/auth/register
  ✓ Creates new user account
  ✓ Returns user profile and tokens

Step 2: User Login
  POST /api/users/auth/login
  ✓ Authenticates with credentials
  ✓ Returns access and refresh tokens

Step 3: Create Workspace
  POST /api/ws-ch/workspaces
  ✓ Creates new workspace
  ✓ User becomes workspace owner

Step 4: Create Public Channel
  POST /api/ws-ch/workspaces/:workspaceId/channels
  ✓ Creates channel in workspace
  ✓ User becomes channel owner
  ✓ User is automatically added as member

Step 5: Send Message
  POST /api/messages/workspaces/:workspaceId/channels/:channelId/messages
  ✓ Sends message to channel
  ✓ Message includes author information
  ✓ Message assigned sequential number
```

## Test Data

The test uses hardcoded test data:

```typescript
User:
  email: e2e.test@example.com
  username: e2e_test_user
  displayName: E2E Test User

Workspace:
  name: e2e-test-workspace
  displayName: E2E Test Workspace

Channel:
  name: e2e-test-channel
  type: public

Message:
  content: "Hello! This is an E2E test message."
```

## Cleanup

After running tests, clean up test data from databases:

```bash
# From the echo root directory
psql -U postgres -f cleanup.sql
```

This will truncate all tables in all three databases.

## Environment Variables

Tests read service URLs from the project root `.env` file:

```env
USER_SERVICE_URL=http://localhost:8001
WORKSPACE_CHANNEL_SERVICE_URL=http://localhost:8002
MESSAGE_SERVICE_URL=http://localhost:8003
```

## Assertions

Each step validates:

- ✅ HTTP status codes (201, 200, etc.)
- ✅ Response structure (`success`, `data`, `message`)
- ✅ Required fields presence
- ✅ Data types and formats (UUIDs, JWT tokens)
- ✅ Business logic (user becomes owner, member count, etc.)
- ✅ Cross-service consistency (IDs match across services)

## Troubleshooting

### Services not responding

```bash
# Check service logs
docker-compose logs user-service
docker-compose logs workspace-channel-service
docker-compose logs message-service
```

### Database connection errors

```bash
# Check PostgreSQL is running
docker-compose logs postgres

# Verify databases exist
psql -U postgres -l
```

### Authentication failures

Ensure `JWT_SECRET` is consistent across all services in `.env` files.

## Test Output

Successful test run:

```
 PASS  tests/message-workflow.test.ts
  E2E: Complete Message Creation Workflow
    ✓ should successfully sign up a new user (XXXms)
    ✓ should successfully log in with credentials (XXXms)
    ✓ should successfully create a workspace (XXXms)
    ✓ should successfully create a public channel in the workspace (XXXms)
    ✓ should successfully send a message to the channel (XXXms)

================================================================================
🎉 E2E Test Completed Successfully!
================================================================================
Test Data Created:
  👤 User ID:       xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  🏢 Workspace ID:  xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  📺 Channel ID:    xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  💬 Message ID:    xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
================================================================================
Note: Run cleanup.sql to remove test data from databases
================================================================================

Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
```

## CI/CD Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run E2E Tests
  run: |
    docker-compose up -d
    cd system-tests/api-e2e
    npm install
    npm test
    docker-compose down
```

## License

MIT

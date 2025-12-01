# Echo API End-to-End Tests

Comprehensive end-to-end API tests for Echo microservices architecture.

## Overview

These tests validate the complete user workflow across all Echo microservices:

1. **User Service** - User signup and authentication
2. **Workspace-Channel Service** - Workspace and channel management, invitations
3. **Message Service** - Message creation and management
4. **BFF Service** - Real-time messaging via WebSocket

## Test Suites

### 1. Message Workflow Test (`message-workflow.test.ts`)

Basic workflow testing HTTP APIs across services:

- User signup and login
- Workspace and channel creation
- Message sending

### 2. Invite Workflow Test (`invite-workflow.test.ts`)

Complete workspace invite workflow with email verification:

- User1 creates workspace and sends invite to User2's email
- User2 receives invite email (verified via MailHog)
- User2 registers and accepts invite
- User2 verified as workspace member with correct role
- User2 sends messages to all workspace channels

### 3. BFF WebSocket Workflow Test (`bff-websocket-workflow.test.ts`)

Complete real-time messaging workflow:

- User1 creates workspace and invite
- User2 joins workspace via invite
- User2 connects to BFF WebSocket
- User2 receives real-time message from User1

## Prerequisites

### 1. Running Services

All services must be running via Docker Compose:

```bash
cd /path/to/echo
docker-compose up -d
```

**Important:** For the invite workflow test, ensure MailHog is running and the notification-service is configured to use SMTP:

```bash
# In your .env file, set:
USE_SMTP=true
SMTP_HOST=mailhog  # or localhost if running outside Docker
SMTP_PORT=1025
```

### 3. Service Health Check

Verify all services are healthy:

```bash
# User Service
curl http://localhost:8001/health

# Workspace-Channel Service
curl http://localhost:8002/health

# Message Service
curl http://localhost:8003/health

# BFF Service
curl http://localhost:8004/health

# MailHog (for invite workflow test)
curl http://localhost:8025
```

### 4. MailHog Setup

MailHog is used for testing email notifications in the invite workflow test.

**Access MailHog Web UI:**

```
http://localhost:8025
```

**MailHog ports:**

- SMTP: `1025`
- HTTP API: `8025`

**Docker command to run MailHog standalone:**

```bash
docker run -d -p 1025:1025 -p 8025:8025 --name mailhog mailhog/mailhog
```

MailHog is automatically started when you run `docker-compose up` and is available as a service in the Echo stack.

# Workspace-Channel Service

curl http://localhost:8002/health

### Run specific test suite

````bash
# Basic message workflow
npm test message-workflow

# Workspace invite workflow (requires MailHog)
npm test invite-workflow

# BFF WebSocket workflow
npm test bff-websocket-workflow
```Installation

```bash
cd system-tests/api-e2e
npm install
````

## Running Tests

### Run all tests

```bash
npm test
```

### Run specific test suite

```bash
# Basic message workflow
npm test message-workflow

# BFF WebSocket workflow
npm test bff-websocket-workflow
```

### Run tests in watch mode

```bash
npm run test:watch
```

### Run tests with verbose output

```bash
npm run test:verbose
```

## Test Workflows

### Basic Message Workflow (`message-workflow.test.ts`)

```
┌─────────────────────────────────────────────────────────┐
│            Basic Message Workflow (HTTP)                │
└─────────────────────────────────────────────────────────┘

Step 1: User Signup
  POST /api/users/auth/register
  ✓ Creates new user account
  ✓ Returns user profile

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

### Invite Workflow (`invite-workflow.test.ts`)

```
┌─────────────────────────────────────────────────────────┐
│     Complete Workspace Invite Workflow (with Email)     │
└─────────────────────────────────────────────────────────┘

Step 1: User1 Registers
  POST /api/users/auth/register
  ✓ Creates user1 (inviter) account

Step 2: User1 Logs In
  POST /api/users/auth/login
  ✓ Authenticates user1

Step 3: User1 Creates Workspace
  POST /api/ws-ch/workspaces
  ✓ Creates workspace

Step 4: User1 Sends Invite
  POST /api/ws-ch/workspaces/:workspaceId/invites
  ✓ Creates invite for user2's email
  ✓ Invite includes token, role, expiration
  ✓ Triggers email notification event

Step 5: User2 Receives Email
  MailHog API: GET /api/v2/messages
  ✓ Email delivered to MailHog inbox
  ✓ Subject contains "invited" and "workspace"
  ✓ Email body contains invite token
  ✓ Token extracted from email HTML

Step 6: User2 Registers
  POST /api/users/auth/register
  ✓ Creates user2 account (invited user)
  ✓ Uses same email as invite

Step 7: User2 Logs In
  POST /api/users/auth/login
  ✓ Authenticates user2

Step 8: User2 Accepts Invite
  POST /api/ws-ch/workspaces/invites/accept
  ✓ Accepts invite using token from email
  ✓ User2 added to workspace
  ✓ User2 added to workspace channels
  ✓ Returns workspace and channel details

Step 9: Verify Membership
  GET /api/ws-ch/workspaces/:workspaceId
  ✓ User2 confirmed as workspace member
  ✓ User2 has "member" role

Step 10: User2 Sends Messages
  POST /api/messages/workspaces/:workspaceId/channels/:channelId/messages
  ✓ User2 sends message to each channel
  ✓ Messages created successfully
  ✓ Verifies user2 has access to all channels
```

### BFF WebSocket Workflow (`bff-websocket-workflow.test.ts`)

```
┌─────────────────────────────────────────────────────────┐
│        Real-Time Messaging Workflow (WebSocket)         │
└─────────────────────────────────────────────────────────┘

Step 1: User1 Signup
  POST /api/users/auth/register
  ✓ Creates user1 account

Step 2: User1 Login
  POST /api/users/auth/login
  ✓ Authenticates user1

Step 3: User1 Creates Workspace
  POST /api/ws-ch/workspaces
  ✓ Creates workspace with auto-generated 'general' channel

Step 4: User1 Creates Invite
  POST /api/ws-ch/workspaces/:workspaceId/invites
  ✓ Generates invite token for user2

Step 5: User2 Signup
  POST /api/users/auth/register
  ✓ Creates user2 account

Step 6: User2 Login
  POST /api/users/auth/login
  ✓ Authenticates user2

Step 7: User2 Accepts Invite
  POST /api/ws-ch/invites/:token/accept
  ✓ User2 joins workspace
  ✓ User2 added to 'general' channel

Step 8: User2 Connects to BFF WebSocket
  WebSocket connection to BFF Service
  ✓ Authenticates with JWT token
  ✓ Joins workspace room
  ✓ Joins general channel room

Step 9: Real-Time Message Delivery
  User1: POST /api/messages/... (HTTP)
  User2: Receives 'message:created' event (WebSocket)
  ✓ Message delivered in real-time
  ✓ Message includes full author info
  ✓ RabbitMQ → BFF → Socket.IO pipeline verified
```

## Test Data

Tests use timestamped data to avoid conflicts:

### Basic Message Workflow

```typescript
User:
  email: e2e.test.{timestamp}@example.com
  username: e2e_test_{timestamp}

Workspace:
  name: e2e-test-workspace

Channel:
  name: e2e-test-channel
```

### Invite Workflow

```typescript
User1 (Inviter):
  email: e2e.inviter.{timestamp}@example.com
  username: e2e_inviter_{timestamp}

User2 (Invited):
  email: e2e.invited.{timestamp}@example.com
  username: e2e_invited_{timestamp}

Workspace:
  name: e2e-invite-ws-{timestamp}

Invite:
  role: member
  expiresInDays: 7
  customMessage: "Welcome to our E2E test workspace!"
```

### BFF WebSocket Workflow

```typescript
User1:
  email: e2e.user1.{timestamp}@example.com
  username: e2e_user1_{timestamp}

User2:
  email: e2e.user2.{timestamp}@example.com
  username: e2e_user2_{timestamp}

Workspace:
  name: e2e-ws-{timestamp}

Channel:
  name: general (auto-created)
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
MAILHOG_API_URL=http://localhost:8025
```

**For Invite Workflow Test:**

The notification-service must be configured to use SMTP (MailHog) instead of Resend:

```env
# In notification-service .env or root .env
USE_SMTP=true
SMTP_HOST=localhost  # or 'mailhog' if running in Docker
SMTP_PORT=1025
```

## Assertions

Each step validates:

- ✅ HTTP status codes (201, 200, etc.)
- ✅ Response structure (`success`, `data`, `message`)
- ✅ Required fields presence
- ✅ Data types and formats (UUIDs, JWT tokens)
- ✅ Business logic (user becomes owner, member count, etc.)
- ✅ Cross-service consistency (IDs match across services)
- ✅ **Invite workflow:** Email delivery, token extraction, workspace membership

## Troubleshooting

### MailHog not receiving emails

```bash
# Check notification-service is using SMTP
docker-compose logs notification-service | grep SMTP

# Check MailHog is running
curl http://localhost:8025

# Verify USE_SMTP=true in environment
docker-compose exec notification-service env | grep USE_SMTP
```

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

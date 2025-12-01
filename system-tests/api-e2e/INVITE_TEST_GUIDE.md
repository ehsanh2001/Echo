# Running the Invite Workflow E2E Test

This guide shows how to run the complete workspace invite workflow E2E test with email verification using MailHog.

## Quick Start

### 1. Start MailHog and all services

```bash
# From the echo directory
cd /path/to/echo

# Start all services including MailHog
docker-compose up -d

# Verify MailHog is running
curl http://localhost:8025
```

### 2. Configure notification-service to use SMTP

Edit your `.env` file (or `services/notification-service/.env`):

```env
USE_SMTP=true
SMTP_HOST=localhost  # or 'mailhog' if running inside Docker
SMTP_PORT=1025
```

### 3. Restart notification-service to apply changes

```bash
docker-compose restart notification-service

# Verify SMTP is enabled
docker-compose logs notification-service | grep "SMTP"
# Should see: "📧 Using SMTP Email Service (MailHog)"
```

### 4. Run the invite workflow test

```bash
cd system-tests/api-e2e
npm test invite-workflow
```

## Docker Command to Run MailHog Standalone

If you want to run MailHog outside of docker-compose:

```bash
docker run -d \
  -p 1025:1025 \
  -p 8025:8025 \
  --name mailhog \
  mailhog/mailhog
```

**Ports:**

- `1025` - SMTP server (for sending emails)
- `8025` - Web UI and HTTP API (for viewing/querying emails)

## MailHog Web Interface

Access MailHog's web interface to see emails:

```
http://localhost:8025
```

You can view:

- All received emails
- Email content (HTML and plain text)
- Email headers
- Delete emails manually

## Test Flow

The `invite-workflow.test.ts` performs these steps:

1. **User1 registers and logs in**
2. **User1 creates a workspace**
3. **User1 sends invite to User2's email**
   - Workspace-channel-service creates invite
   - Publishes event to RabbitMQ
   - Notification-service consumes event
   - Email sent to MailHog via SMTP

4. **Test queries MailHog API to retrieve email**
   - Waits up to 30 seconds for email
   - Extracts invite token from email HTML

5. **User2 registers with invited email**
6. **User2 logs in**
7. **User2 accepts invite using token**
   - Added to workspace
   - Added to workspace channels

8. **Verifies User2 membership**
   - Checks workspace role (should be "member")
   - Verifies User2 in workspace

9. **User2 sends messages to all channels**
   - Tests User2 has access to channels
   - Sends message to each channel User2 is member of

## Troubleshooting

### Email not received in MailHog

**Check notification-service is using SMTP:**

```bash
docker-compose logs notification-service | grep "Email Service"
```

Expected output: `📧 Using SMTP Email Service (MailHog)`

**Check MailHog is running:**

```bash
docker-compose ps mailhog
```

**Check SMTP configuration:**

```bash
docker-compose exec notification-service env | grep -E "USE_SMTP|SMTP_HOST|SMTP_PORT"
```

**Manually test SMTP connection:**

```bash
# Install telnet if needed
telnet localhost 1025
# Should connect successfully
```

### Test timeout waiting for email

If test fails with "Email not received", check:

1. **RabbitMQ is running and notification-service is connected:**

   ```bash
   docker-compose logs notification-service | grep RabbitMQ
   ```

2. **Invite was created successfully** (check workspace-channel-service logs):

   ```bash
   docker-compose logs workspace-channel-service | grep invite
   ```

3. **Notification-service consumed the event:**

   ```bash
   docker-compose logs notification-service | grep "workspace.invite.created"
   ```

4. **Check MailHog received anything:**
   ```bash
   curl http://localhost:8025/api/v2/messages
   ```

### Services not healthy

```bash
# Check all service health
docker-compose ps

# Restart problematic services
docker-compose restart notification-service
docker-compose restart rabbitmq
docker-compose restart mailhog
```

### Database issues

Ensure all databases are created and migrated:

```bash
# Check databases exist
psql -U postgres -l | grep -E "users_db|workspace_channels_db|message_db"

# Run migrations if needed
cd services/user-service && npx prisma migrate deploy
cd services/workspace-channel-service && npx prisma migrate deploy
cd services/message-service && npx prisma migrate deploy
```

## Cleanup

After running tests, clean up test data:

```bash
cd /path/to/echo
psql -U postgres -f cleanup.sql
```

Clear MailHog inbox:

```bash
curl -X DELETE http://localhost:8025/api/v1/messages
```

## Production Configuration

For production, set `USE_SMTP=false` and configure Resend:

```env
USE_SMTP=false
RESEND_API_KEY=re_your_actual_api_key_here
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
EMAIL_FROM_NAME=Your App Name
```

The EmailService will automatically use Resend instead of SMTP.

## Test Output Example

Successful test run:

```
 PASS  tests/invite-workflow.test.ts (45.123s)
  E2E: Complete Workspace Invite Workflow
    ✓ should successfully register user1 (inviter) (234ms)
    ✓ should successfully log in user1 (156ms)
    ✓ should successfully create a workspace (298ms)
    ✓ should successfully create workspace invite for user2 (412ms)
    ✓ should receive invite email in MailHog (2145ms)
    ✓ should successfully register user2 (invited user) (198ms)
    ✓ should successfully log in user2 (142ms)
    ✓ should successfully accept workspace invite (345ms)
    ✓ should verify user2 is a member of the workspace (123ms)
    ✓ should successfully send messages to all channels user2 is member of (567ms)

================================================================================
🎉 E2E Invite Workflow Test Completed Successfully!
================================================================================
Test Data Created:
  👤 User1 (Inviter) ID:    xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  👤 User2 (Invited) ID:    xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  🏢 Workspace ID:          xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  🔑 Invite Token:          xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  📺 Channels (2):          general, random
================================================================================

Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
```

## Next Steps

- Run all E2E tests: `npm test`
- View test coverage: `npm run test:coverage`
- Watch mode for development: `npm run test:watch`

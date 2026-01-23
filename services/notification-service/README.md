# Notification Service

Email notification service for the Echo Slack MVP application. Consumes workspace events from RabbitMQ and sends emails via SMTP (MailHog for development, Gmail for production).

## Features

- 📧 Email notifications via SMTP (MailHog/Gmail)
- 🐰 RabbitMQ event consumer
- 📝 Handlebars email templates
- 🔍 Winston logging
- 🏥 Health check endpoint
- 🐳 Docker support

## Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure environment:**

   ```bash
   cp .env.example .env
   ```

   Update `.env` with your configuration:
   - `EMAIL_SERVICE_NAME`: Set to `MailHog` for development or `Gmail` for production
   - `GMAIL_USER`: Your Gmail address (required for Gmail)
   - `GMAIL_APP_PASSWORD`: Your Gmail App Password (required for Gmail)
   - `RABBITMQ_URL`: RabbitMQ connection string
   - `FRONTEND_BASE_URL`: Frontend application URL

3. **Development:**

   ```bash
   npm run dev
   ```

4. **Build:**
   ```bash
   npm run build
   npm start
   ```

## Environment Variables

| Variable             | Description                             | Default                      |
| -------------------- | --------------------------------------- | ---------------------------- |
| `NODE_ENV`           | Environment (development/production)    | `development`                |
| `EMAIL_SERVICE_NAME` | Email service: `MailHog` or `Gmail`     | `MailHog`                    |
| `EMAIL_FROM_NAME`    | Sender display name                     | `Echo App`                   |
| `MAILHOG_HOST`       | MailHog SMTP host (for MailHog)         | `localhost`                  |
| `MAILHOG_PORT`       | MailHog SMTP port (for MailHog)         | `1025`                       |
| `GMAIL_USER`         | Gmail address (required for Gmail)      | -                            |
| `GMAIL_APP_PASSWORD` | Gmail App Password (required for Gmail) | -                            |
| `RABBITMQ_URL`       | RabbitMQ connection URL (required)      | -                            |
| `RABBITMQ_EXCHANGE`  | Exchange name (set in project .env)     | `echo.events`                |
| `RABBITMQ_QUEUE`     | Queue name                              | `notification_service_queue` |
| `FRONTEND_BASE_URL`  | Frontend URL for email links (required) | -                            |
| `USER_SERVICE_URL`   | User service URL                        | `http://localhost:8001`      |
| `LOG_LEVEL`          | Logging level                           | `info`                       |

## API Endpoints

### Health Check

```
GET /health
```

Returns service health status.

## Supported Events

### workspace.invite.created

Sends workspace invitation email when a new workspace invite is created.

**Event payload:**

```json
{
  "inviteId": "uuid",
  "workspaceId": "uuid",
  "workspaceName": "My Workspace",
  "email": "user@example.com",
  "inviterUserId": "uuid",
  "role": "member",
  "inviteUrl": "http://localhost:3000/invite/accept/abc123...",
  "expiresAt": "2024-01-01T00:00:00Z"
}
```

## Architecture

```
RabbitMQ (echo.events)
    ↓
RabbitMQConsumer (workers/)
    ↓
EventHandler (workers/)
    ↓
EmailService (services/)
    ↓
SMTP (MailHog/Gmail) → Email Delivered
```

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## Development Workflow

1. RabbitMQ publishes `workspace.invite.created` event
2. Consumer picks up event from `notification_service_queue`
3. Event handler validates and processes the event
4. Template service renders email HTML from Handlebars template
5. Email service sends email via SMTP (MailHog or Gmail)
6. Logs success/failure

## Email Configuration

### MailHog (Development)

MailHog is used for local development and testing. It provides a web UI to view sent emails at `http://localhost:8025`.

Set `EMAIL_SERVICE_NAME=MailHog` in your environment.

### Gmail (Production)

For production, use Gmail with an App Password:

1. Enable 2-Step Verification in your Google Account
2. Generate an App Password: Google Account → Security → 2-Step Verification → App passwords
3. Set environment variables:
   ```
   EMAIL_SERVICE_NAME=Gmail
   GMAIL_USER=your-email@gmail.com
   GMAIL_APP_PASSWORD=your-app-password
   ```

## Next Steps (Phases 2-7)

- [ ] Phase 2: Implement RabbitMQ consumer
- [ ] Phase 3: Implement Email service with SMTP
- [ ] Phase 4: Create event handlers
- [ ] Phase 5: Docker deployment
- [ ] Phase 6: Testing suite
- [ ] Phase 7: Monitoring & observability

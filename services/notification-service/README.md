# Notification Service

Email notification service for the Echo Slack MVP application. Consumes workspace events from RabbitMQ and sends emails via Resend.

## Features

- 📧 Email notifications via Resend API
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
   - `RESEND_API_KEY`: Get from https://resend.com/api-keys
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
| `PORT`               | Service port                            | `8004`                       |
| `RESEND_API_KEY`     | Resend API key (required)               | -                            |
| `EMAIL_FROM_ADDRESS` | Sender email address                    | `onboarding@resend.dev`      |
| `EMAIL_FROM_NAME`    | Sender name                             | `Echo Workspace`             |
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
Resend API → Email Delivered
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
5. Email service sends email via Resend API
6. Logs success/failure

## Resend Configuration

For development, you can use Resend's test email addresses:

- **From:** `onboarding@resend.dev`
- **To:** `delivered@resend.dev`

Free tier limits:

- 100 emails/day
- 3,000 emails/month

## Next Steps (Phases 2-7)

- [ ] Phase 2: Implement RabbitMQ consumer
- [ ] Phase 3: Implement Email service with Resend
- [ ] Phase 4: Create event handlers
- [ ] Phase 5: Docker deployment
- [ ] Phase 6: Testing suite
- [ ] Phase 7: Monitoring & observability

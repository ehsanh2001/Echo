# Echo Project - AI Agent Instructions

## Coding patterns and Architecture

- Follow SOLID principles and clean architecture.
- Follow DRY - avoid code duplication.
- Follow YAGNI - don't implement unused features.
- When implementing a class/method or updating it, after implementation read the whole class and its package to ensure it follows best practices and is clean.
- Extract common logic into reusable functions or classes.
- When you need new types/interfaces, define them in a dedicated `types` or `interfaces` file. But before that, check if similar types/interfaces already exist.
- Check existing service patterns (especially message-service for complete examples).
- Before implementing ask any clarifying questions if requirements are ambiguous or missing.

## 🏗️ Architecture Overview

Echo is a **monorepo microservices messaging platform** with event-driven architecture. Services communicate via HTTP APIs and RabbitMQ events, with real-time features via Socket.IO. It uses PostgreSQL for data storage and Redis for caching and pub/sub. The stack includes React frontend, Node.js/ExpressJS backend services, and Python AI service.

## 🔑 Critical Patterns

### Multi-Level Environment Configuration

All Node.js services use **two-level .env loading** (see `services/*/src/config/env.ts`):

```typescript
// 1. Load project-level .env (shared defaults)
dotenv.config({ path: "../../../../.env" });
// 2. Load service-level .env (overrides project-level)
dotenv.config({ path: "../../.env", override: true });
```

**Pattern:** Project `.env` defines shared infrastructure (REDIS_URL, RABBITMQ_URL), service `.env` overrides with service-specific values (REDIS_KEY_PREFIX, PORT, SERVICE_NAME).

### Dependency Injection with tsyringe

All services use **interface-based DI** (see `services/*/src/container.ts`):

## 🛠️ Development Workflows

**Database location:** PostgreSQL runs on host machine (not containerized in dev). Services in Docker connect via `host.docker.internal`.

### Testing Patterns

Tests organized by type (see `services/*/tests/`):

- **Unit tests**: Mock dependencies with `jest.Mocked<Interface>`
- **Integration tests**: Use test database (DATABASE_URL_TEST), seed data, cleanup after
- **File naming**: `*.unit.test.ts`, `*.integration.test.ts`

**Test database strategy:** Each service has separate test database. Use `getDatabaseUrl()` helper to switch between dev/test based on NODE_ENV.

Run 'Jest' with '--maxWorkers=1' to avoid deletion of other tests data on shared test DB.

## 📐 Code Conventions

### TypeScript Configuration

- **Target:** ES2022, Module: ESNext (supports top-level await, class fields)
- **Strict mode:** Always enabled
- **Decorators:** `experimentalDecorators: true, emitDecoratorMetadata: true` (required for tsyringe)
- **Paths:** Never use path aliases - always relative imports

### Service Structure

Standard directory layout (see `services/bff-service/src/`):

```
src/
├── config/         # Environment, DB connection
├── controllers/    # HTTP request handlers
├── interfaces/     # TypeScript interfaces (repositories, services)
├── middleware/     # Express middleware (auth, validation)
├── routes/         # Express route definitions
├── services/       # Business logic (injectable)
├── repositories/   # Data access (injectable)
├── types/          # Shared types, enums
├── utils/          # Helpers, logger, factories
├── workers/        # Background jobs (outbox, consumers)
├── container.ts    # DI registration
└── index.ts        # Server entry point
```

### Logging with Winston

All services use Winston (see `services/*/src/utils/logger.ts`):

- **Development:** Colorized console output
- **Production:** JSON format for log aggregation
- **File transports:** `error.log` (errors only), `combined.log` (all logs), 5MB rotation
- **Usage:** `logger.info()`, `logger.error()`, `logger.warn()`, `logger.http()`

### Error Handling

Custom error types per domain (see `services/message-service/src/utils/error.ts`):

```typescript
export class UserServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "UserServiceError";
  }
}
```

## 🔄 Inter-Service Communication

### HTTP Service-to-Service Calls

Services call each other via internal URLs (configured in .env):

```typescript
// Example: Message service enriching with user data
const userResponse = await axios.get(
  `${config.externalServices.userServiceUrl}/api/users/${userId}`
);
```

**Pattern:** Use axios with proper error handling. Services validate responses and implement fallbacks (e.g., "Unknown User" if user service unavailable).

### RabbitMQ Event Publishing

workspace-channel-service publishers use **Outbox Service** (see `workspace-channel-service/src/services/OutboxService.ts`):

Other services do not use **Outbox Service**; they publish directly to RabbitMQ when needed.
Consumers use **RabbitMQ Connection Manager** pattern (see BFF service roadmap for implementation).

## Common Gotchas

1. **Redis key prefixes:** Always use service-specific prefix (BFF_SERVICE:, USER_SERVICE:). RedisService handles automatically, but raw clients must prefix manually.

2. **Graceful shutdown:** All services implement SIGTERM/SIGINT handlers that close HTTP server, Socket.IO, Redis, RabbitMQ connections with 10s timeout.

## Key Files Reference

- **Environment config:** `src/config/env.ts` (multi-level .env loading)
- **Workspace orchestration:** `package.json` (root, uses npm workspaces)

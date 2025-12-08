# @echo/correlation

Request correlation and context management package for Echo services using AsyncLocalStorage.

## Features

- ✅ **Automatic correlation ID generation** - UUID-based request tracking
- ✅ **AsyncLocalStorage context** - Context travels through async operations
- ✅ **HTTP header propagation** - X-Request-ID header support
- ✅ **Business context tracking** - userId, workspaceId, channelId
- ✅ **Request metadata** - method, path, IP, user agent
- ✅ **Contextual logger** - Auto-injects context into all logs
- ✅ **Morgan integration** - HTTP request logging with context
- ✅ **Fail-safe** - Never breaks requests due to correlation issues
- ✅ **TypeScript support** - Full type definitions included

## Installation

From any service directory:

```bash
npm install file:../shared/correlation
```

Or add to `package.json`:

```json
{
  "dependencies": {
    "@echo/correlation": "file:../shared/correlation"
  }
}
```

## Quick Start

```typescript
import express from 'express';
import {
  correlationMiddleware,
  createContextualLogger,
  createHttpLogger,
  setUserId,
  updateContext
} from '@echo/correlation';

const app = express();

// 1. Create contextual logger
const logger = createContextualLogger({
  serviceName: 'user-service',
  logLevel: 'info'
});

// 2. Add correlation middleware (FIRST)
app.use(correlationMiddleware('user-service'));

// 3. Add HTTP logging middleware
app.use(createHttpLogger(logger));

// 4. Add your JWT authentication middleware
app.use(jwtAuthMiddleware);

// 5. Update context after authentication
app.use((req: AuthenticatedRequest, res, next) => {
  if (req.user?.userId) {
    updateContext({
      userId: req.user.userId,
      workspaceId: req.user.workspaceId
    });
  }
  next();
});

// 6. Use logger anywhere - context is automatic!
app.get('/api/users', (req, res) => {
  logger.info('Fetching users'); // Auto-includes correlationId, userId, etc.
  // ...
});
```

## Core Concepts

### AsyncLocalStorage

The package uses Node.js `AsyncLocalStorage` to maintain request context through the entire call stack, including:
- Synchronous function calls
- Async/await operations
- Promise chains
- Event handlers
- Database queries

No need to pass context objects manually!

### Correlation ID

A unique identifier (UUID) for each request that:
- Is generated automatically or read from `X-Request-ID` header
- Propagates across service boundaries
- Appears in response headers
- Is included in all logs automatically

### Request Context

The context object contains:

```typescript
interface RequestContext {
  correlationId: string;   // Always present
  timestamp: Date;          // Request start time
  method?: string;          // HTTP method (GET, POST, etc.)
  path?: string;            // Request path
  ip?: string;              // Client IP address
  userAgent?: string;       // User agent string
  userId?: string;          // Set after authentication
  workspaceId?: string;     // Business context
  channelId?: string;       // Business context
}
```

## API Reference

### Middleware

#### `correlationMiddleware(serviceName: string)`

Creates correlation context for each request. **Must be first middleware.**

```typescript
app.use(correlationMiddleware('user-service'));
```

Features:
- Reads `X-Request-ID` header or generates new UUID
- Sets response headers (`X-Request-ID`, `X-Correlation-ID`)
- Captures request metadata (method, path, IP, user agent)
- Creates AsyncLocalStorage context
- Fails silently if errors occur

#### `userContextMiddleware()`

Optional middleware to extract userId from authenticated request.
Use AFTER JWT authentication middleware.

```typescript
app.use(jwtAuthMiddleware);
app.use(userContextMiddleware());
```

### Context Getters

Get values from the current request context:

```typescript
import {
  getContext,
  getCorrelationId,
  getUserId,
  getWorkspaceId,
  getChannelId,
  getMethod,
  getPath,
  getIp,
  getUserAgent,
  hasContext
} from '@echo/correlation';

// Get full context
const context = getContext(); // Returns RequestContext | undefined

// Get specific values
const correlationId = getCorrelationId(); // Returns string | undefined
const userId = getUserId();
const workspaceId = getWorkspaceId();
const channelId = getChannelId();
const method = getMethod();
const path = getPath();
const ip = getIp();
const userAgent = getUserAgent();

// Check if in request context
if (hasContext()) {
  // We're inside a request
}
```

### Context Setters

Update the current request context:

```typescript
import {
  setUserId,
  setWorkspaceId,
  setChannelId,
  updateContext
} from '@echo/correlation';

// Individual setters
setUserId('user-123');
setWorkspaceId('workspace-456');
setChannelId('channel-789');

// Bulk update (preferred for multiple values)
updateContext({
  userId: 'user-123',
  workspaceId: 'workspace-456',
  channelId: 'channel-789'
});
```

**Important:** Setters only work inside request context (after correlation middleware runs).

### Contextual Logger

Create a logger that automatically injects correlation context:

```typescript
import { createContextualLogger } from '@echo/correlation';

const logger = createContextualLogger({
  serviceName: 'user-service',
  logLevel: 'info',
  enableFileLogging: true
});

// All logs automatically include correlationId, userId, workspaceId, etc.
logger.info('User created', { email: 'user@example.com' });
// Output: { timestamp, level, message, service, correlationId, userId, email }

logger.error('Database error', { error: err.message });
// Output: { timestamp, level, message, service, correlationId, userId, error, stack }
```

**Auto-injected fields:**
- `correlationId` - Request correlation ID
- `userId` - Authenticated user ID (if set)
- `workspaceId` - Current workspace ID (if set)
- `channelId` - Current channel ID (if set)
- `method` - HTTP method
- `path` - Request path

### HTTP Logger

Create Morgan HTTP logging middleware:

```typescript
import { createHttpLogger, MorganFormats } from '@echo/correlation';

const logger = createContextualLogger({ serviceName: 'user-service' });

// Default format
const httpLogger = createHttpLogger(logger);
app.use(httpLogger);

// Custom format
const customLogger = createHttpLogger(
  logger,
  ':method :url :status :response-time ms - :correlation-id'
);
app.use(customLogger);

// Predefined formats
app.use(createHttpLogger(logger, MorganFormats.minimal));
app.use(createHttpLogger(logger, MorganFormats.standard));
app.use(createHttpLogger(logger, MorganFormats.detailed));
```

**Custom Morgan tokens available:**
- `:correlation-id` - Request correlation ID
- `:user-id` - Authenticated user ID
- `:workspace-id` - Current workspace ID

## Usage Patterns

### Basic Service Setup

```typescript
import express from 'express';
import {
  correlationMiddleware,
  createContextualLogger,
  createHttpLogger
} from '@echo/correlation';

const app = express();
const logger = createContextualLogger({ serviceName: 'user-service' });

// Middleware order matters!
app.use(correlationMiddleware('user-service'));  // 1. Create context
app.use(createHttpLogger(logger));               // 2. Log HTTP requests
app.use(express.json());                         // 3. Body parsing
app.use(jwtAuthMiddleware);                      // 4. Authentication

app.listen(3000, () => {
  logger.info('Server started', { port: 3000 });
});
```

### Setting User Context After Authentication

```typescript
import { updateContext } from '@echo/correlation';

// In JWT middleware
app.use((req: AuthenticatedRequest, res, next) => {
  if (req.user?.userId) {
    updateContext({
      userId: req.user.userId,
      workspaceId: req.headers['x-workspace-id'] as string,
    });
  }
  next();
});
```

### Logging in Controllers

```typescript
import { logger } from '../utils/logger'; // Contextual logger

export class UserController {
  async createUser(req: Request, res: Response) {
    // No need to pass correlationId manually!
    logger.info('Creating user', { email: req.body.email });
    
    try {
      const user = await this.userService.create(req.body);
      logger.info('User created successfully', { userId: user.id });
      res.json({ success: true, data: user });
    } catch (error) {
      logger.error('Failed to create user', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
```

### Logging in Services

```typescript
import { logger } from '../utils/logger';

export class UserService {
  async create(data: CreateUserDto) {
    // Context flows through the call stack automatically
    logger.debug('Validating user data', { email: data.email });
    
    const user = await this.repository.create(data);
    
    logger.info('User created in database', { 
      userId: user.id,
      action: 'user.created'
    });
    
    return user;
  }
}
```

### Inter-Service Communication

When making HTTP calls to other services, propagate the correlation ID:

```typescript
import axios from 'axios';
import { getCorrelationId } from '@echo/correlation';

// Manual propagation
const response = await axios.get('http://user-service/api/users', {
  headers: {
    'X-Request-ID': getCorrelationId(),
    'Authorization': `Bearer ${token}`
  }
});

// Or use Axios interceptor (recommended)
import { getCorrelationId } from '@echo/correlation';

axiosInstance.interceptors.request.use((config) => {
  const correlationId = getCorrelationId();
  if (correlationId) {
    config.headers['X-Request-ID'] = correlationId;
  }
  return config;
});
```

### RabbitMQ Events (Coming in Phase 5)

```typescript
import { getCorrelationId } from '@echo/correlation';

// When publishing events
const event = {
  type: 'user.created',
  payload: { userId: user.id },
  correlationId: getCorrelationId(),
  timestamp: new Date()
};

await publishEvent(event);
```

## Log Output Examples

### Development (Colorized)

```
2025-12-08 10:30:45:123 [user-service] info: User created {
  correlationId: 'abc-123-def',
  userId: 'user-456',
  workspaceId: 'workspace-789',
  method: 'POST',
  path: '/api/users',
  email: 'user@example.com'
}
```

### Production (JSON)

```json
{
  "timestamp": "2025-12-08 10:30:45:123",
  "level": "info",
  "message": "User created",
  "service": "user-service",
  "correlationId": "abc-123-def",
  "userId": "user-456",
  "workspaceId": "workspace-789",
  "method": "POST",
  "path": "/api/users",
  "email": "user@example.com"
}
```

## Error Handling

The correlation middleware fails silently to never break requests:

```typescript
// If correlation setup fails
try {
  // Normal correlation setup
} catch (error) {
  console.error('Correlation middleware error:', error);
  // Generate fallback correlation ID
  // Set headers
  // Continue with request
}
```

## Best Practices

### 1. Middleware Order

```typescript
app.use(correlationMiddleware('service-name'));  // ALWAYS FIRST
app.use(createHttpLogger(logger));
app.use(express.json());
app.use(jwtAuthMiddleware);
app.use(updateUserContext);
// ... your routes
```

### 2. Create Logger Once

```typescript
// ✅ Good - create once, export
// src/utils/logger.ts
export const logger = createContextualLogger({ 
  serviceName: 'user-service' 
});

// ❌ Bad - creates new logger every import
export function getLogger() {
  return createContextualLogger({ serviceName: 'user-service' });
}
```

### 3. Use Bulk Updates

```typescript
// ✅ Good - single update
updateContext({ userId, workspaceId, channelId });

// ❌ Okay but less efficient
setUserId(userId);
setWorkspaceId(workspaceId);
setChannelId(channelId);
```

### 4. Always Check Context

```typescript
// In non-request code (background jobs, etc.)
if (hasContext()) {
  logger.info('Processing with context');
} else {
  logger.info('Processing without context');
}
```

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run dev
# or
npm run build:watch
```

### Clean

```bash
npm run clean
```

## Dependencies

- `@echo/logger` - Base Winston logger
- `uuid` - Correlation ID generation
- `morgan` - HTTP request logging

## TypeScript Support

Full TypeScript definitions included. Import types:

```typescript
import type { RequestContext, ContextUpdate } from '@echo/correlation';
import type { LoggerConfig } from '@echo/correlation';
```

## Troubleshooting

### Context is undefined

Make sure `correlationMiddleware` is the first middleware:

```typescript
app.use(correlationMiddleware('service-name')); // Must be first!
```

### Context not propagating to async operations

AsyncLocalStorage should handle this automatically. If issues occur, ensure you're using Node.js 16+ and not using `setTimeout` or `setImmediate` without proper context.

### Logs missing correlation data

1. Check that correlation middleware is running
2. Verify you're using `createContextualLogger`, not plain `createLogger`
3. Ensure context setters are called after correlation middleware

## License

ISC

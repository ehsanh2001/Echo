# @echo/logger

Shared Winston logger package for Echo services.

## Features

- ✅ **Environment-based formatting**: JSON in production, colorized in development
- ✅ **Daily log file rotation**: Automatically creates daily log files with configurable retention
- ✅ **Service tagging**: All logs include service name for easy filtering
- ✅ **Multiple log levels**: error, warn, info, http, debug
- ✅ **Separate error logs**: Error-level logs written to dedicated error log files
- ✅ **Configurable**: Customize log level, directory, file size, and retention
- ✅ **TypeScript support**: Full type definitions included

## Installation

From any service directory:

```bash
npm install file:../shared/logger
```

Or add to `package.json`:

```json
{
  "dependencies": {
    "@echo/logger": "file:../shared/logger"
  }
}
```

## Usage

### Basic Usage

```typescript
import { createLogger } from "@echo/logger";

const logger = createLogger({
  serviceName: "user-service",
});

logger.info("Service started");
logger.error("Database connection failed", { error: err.message });
logger.debug("Processing request", { userId: "123", action: "login" });
```

### With Configuration

```typescript
import { createLogger } from "@echo/logger";

const logger = createLogger({
  serviceName: "user-service",
  logLevel: "debug",
  enableFileLogging: true,
  logDir: "./logs",
  maxFileSize: "10m",
  maxFiles: "14",
});
```

### With Morgan (HTTP Logging)

```typescript
import express from "express";
import morgan from "morgan";
import { createLogger, createHttpStream } from "@echo/logger";

const app = express();
const logger = createLogger({ serviceName: "user-service" });
const httpStream = createHttpStream(logger);

app.use(morgan("combined", { stream: httpStream }));
```

## Configuration Options

| Option              | Type      | Default                          | Description                                   |
| ------------------- | --------- | -------------------------------- | --------------------------------------------- |
| `serviceName`       | `string`  | **required**                     | Name of the service (e.g., 'user-service')    |
| `logLevel`          | `string`  | `'info'` (prod), `'debug'` (dev) | Minimum log level to output                   |
| `enableFileLogging` | `boolean` | `true`                           | Enable writing logs to files                  |
| `logDir`            | `string`  | `'./logs'`                       | Directory where log files are stored          |
| `maxFileSize`       | `string`  | `'5m'`                           | Maximum size of each log file before rotation |
| `maxFiles`          | `string`  | `'5'`                            | Number of log files to keep                   |

## Environment Variables

The logger respects these environment variables (can be overridden by config):

```bash
# Log level (error, warn, info, http, debug)
LOG_LEVEL=info

# Enable/disable file logging
ENABLE_FILE_LOGGING=true

# Directory for log files
LOG_DIR=./logs

# Node environment (affects default format)
NODE_ENV=production
```

## Log Levels

- **error** (0): Error messages, exceptions
- **warn** (1): Warning messages
- **info** (2): Informational messages (default in production)
- **http** (3): HTTP request/response logs
- **debug** (4): Detailed debug information (default in development)

## Log Output

### Development Format (Colorized)

```
2025-12-04 10:30:45:123 [user-service] info: User created { userId: '123', email: 'user@example.com' }
2025-12-04 10:30:46:456 [user-service] error: Database error { error: 'Connection timeout' }
```

### Production Format (JSON)

```json
{
  "timestamp": "2025-12-04 10:30:45:123",
  "level": "info",
  "message": "User created",
  "service": "user-service",
  "userId": "123",
  "email": "user@example.com"
}
```

## Log Files

When file logging is enabled, logs are written to:

- `logs/combined-YYYY-MM-DD.log` - All logs
- `logs/error-YYYY-MM-DD.log` - Error logs only

Files are rotated daily and old files are automatically deleted based on `maxFiles` setting.

## Development

### Build

```bash
npm run build
```

### Watch Mode (Auto-rebuild on changes)

```bash
npm run dev
# or
npm run build:watch
```

### Clean

```bash
npm run clean
```

## Phase 2 Features (Coming Soon)

In Phase 2, the logger will automatically inject correlation IDs and user context from AsyncLocalStorage:

```typescript
// After Phase 2:
logger.info("User created");
// Output includes auto-injected correlationId, userId, workspaceId, etc.
```

## License

ISC

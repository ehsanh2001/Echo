# @echo/http-client

Shared HTTP client for Echo microservices with automatic correlation ID propagation.

## Features

- 🔗 **Automatic Correlation Propagation**: Forwards `X-Request-ID` and `X-Correlation-ID` headers
- 🔄 **Smart Retry Logic**: Exponential backoff for transient failures
- ⏱️ **Timeout Configuration**: Configurable request timeouts
- 📝 **Debug Logging**: Optional detailed logging for troubleshooting
- 🛡️ **Type Safety**: Full TypeScript support
- 🚀 **Easy Integration**: Drop-in replacement for axios

## Installation

```bash
npm install @echo/http-client @echo/correlation
```

## Usage

### Basic Setup

```typescript
import { createHttpClient } from "@echo/http-client";

const httpClient = createHttpClient({
  serviceName: "bff-service",
  timeout: 30000,
  maxRetries: 3,
  debugLogging: process.env.NODE_ENV === "development",
});
```

### Making Requests

```typescript
// GET request
const user = await httpClient.get("http://user-service:8001/api/users/123", {
  headers: {
    Authorization: req.headers.authorization,
  },
});

// POST request
const workspace = await httpClient.post(
  "http://workspace-service:8002/api/workspaces",
  {
    name: "my-workspace",
    displayName: "My Workspace",
  },
  {
    headers: {
      Authorization: req.headers.authorization,
    },
  }
);
```

### Correlation ID Propagation

The client automatically:

1. Reads correlation ID from AsyncLocalStorage context (via `@echo/correlation`)
2. Adds `X-Request-ID` and `X-Correlation-ID` headers to outgoing requests
3. Forwards `Authorization` header if provided
4. Logs correlation context in debug mode

### Error Handling

```typescript
import { extractErrorMessage } from "@echo/http-client";

try {
  const response = await httpClient.get("http://service/api/endpoint");
} catch (error) {
  const message = extractErrorMessage(error);
  logger.error("Request failed", { error: message });
}
```

## Configuration Options

| Option         | Type      | Default      | Description              |
| -------------- | --------- | ------------ | ------------------------ |
| `serviceName`  | `string`  | **required** | Service name for logging |
| `timeout`      | `number`  | `30000`      | Request timeout in ms    |
| `maxRetries`   | `number`  | `3`          | Max retry attempts       |
| `debugLogging` | `boolean` | `false`      | Enable debug logs        |

## Automatic Retry

The client automatically retries requests on:

- Network errors (no response)
- 5xx server errors
- 429 Too Many Requests
- Connection timeouts

Retry strategy: Exponential backoff (1s, 2s, 4s)

## License

MIT

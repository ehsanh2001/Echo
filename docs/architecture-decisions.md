# Echo Architecture Overview

## 🏗️ Monorepo Microservices Architecture

Echo is built using a monorepo structure with independent microservices, combining unified development workflow with proper service boundaries and event-driven communication.

## 🎯 Core Architecture Principles

### **Service Independence**

- Each service owns its business logic and data
- Services communicate exclusively via APIs and events
- No shared business logic between services
- Independent deployment and scaling capabilities

### **Event-Driven Design**

- Loose coupling through Redis Streams event bus
- Asynchronous processing for AI features and notifications
- Real-time updates via WebSocket connections
- Event sourcing for audit trails and system reliability

### **Database Strategy**

- Database schemas will be designed per service as needed
- Services will own their data and implement appropriate storage solutions
- Database implementation decisions made during service development

## 📁 Project Structure

```
echo/
├── services/                    # Independent microservices
│   ├── api-gateway/            # Request routing and authentication
│   ├── user-service/           # User management and profiles
│   │   ├── src/                # Service implementation
│   │   └── package.json        # Service dependencies
│   ├── message-service/        # Real-time messaging and channels
│   └── ai-service/             # AI features and embeddings
├── frontend/                   # React TypeScript application
├── package.json               # Workspace orchestration
└── scripts/                   # Development utilities
```

## 🔄 Service Communication

### **HTTP API Communication**

```javascript
// Service-to-service communication via HTTP APIs
const user = await userService.getUser(userId);
const channel = await messageService.getChannel(channelId);
```

### **Event-Driven Communication**

```javascript
// Publish events for asynchronous processing
await eventBus.publish("message.created", { messageId, userId, channelId });

// Subscribe to events for cross-service reactions
eventBus.subscribe("message.created", async (event) => {
  await processMessage(event.messageId);
});
```

## 🚀 Technology Stack

### **Backend Services**

- **API Gateway, User Service, Message Service**: Node.js + TypeScript + Express
- **AI Service**: Python + FastAPI
- **Event Bus**: Redis Streams
- **File Storage**: MinIO (S3-compatible)

### **Frontend**

- **Framework**: React + TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Real-time**: WebSocket client

### **Infrastructure**

- **Development**: Docker Compose + Minikube
- **Production**: AWS EKS + ElastiCache + S3
- **CI/CD**: GitHub Actions

## 📊 Service Responsibilities

### **API Gateway** (Port 8080)

- Request routing and load balancing
- Authentication and authorization
- Rate limiting and request validation
- CORS handling and security headers

### **User Service** (Port 8001)

- User registration and authentication
- Profile management and preferences
- Session management and JWT tokens
- User presence and status

### **Message Service** (Port 8002)

- Real-time messaging with WebSockets
- Channel and workspace management
- File upload and sharing
- Message history and search

### **AI Service** (Port 8003)

- Intelligent chat assistant
- Message summarization and insights
- Content analysis and recommendations
- Search enhancement with embeddings

## 🔄 Event Flow Examples

### **Message Creation Flow**

```
1. User sends message → Message Service
2. Message Service stores message → Database
3. Message Service publishes "message.created" event
4. AI Service processes message for embeddings
5. Real-time notification sent to channel members
```

### **User Authentication Flow**

```
1. Login request → API Gateway
2. API Gateway forwards → User Service
3. User Service validates credentials
4. JWT token generated and returned
5. Subsequent requests use JWT for authorization
```

## 🛠️ Development Workflow

### **Service Development**

Each service can be developed independently:

- Independent package.json and dependencies
- Service-specific testing and deployment
- Database schema designed when implementing each service
- Clear API contracts between services

### **Event System**

- Redis Streams for reliable event delivery
- Event versioning for backward compatibility
- Dead letter queues for failed processing
- Event replay capabilities for debugging

## 🌐 Deployment Strategy

### **Local Development**

- Docker Compose for infrastructure services
- Minikube for Kubernetes experience
- Hot reloading for fast development

### **Production**

- AWS EKS for container orchestration
- Auto-scaling based on load
- Blue-green deployment for zero downtime

This architecture provides a solid foundation for building a scalable, maintainable messaging platform while keeping database decisions flexible for implementation time.

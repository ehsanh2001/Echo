# Echo - Modern Messaging Platform

A scalable Slack-style messaging platform built with microservices architecture, event-driven design, and AI capabilities.

## 🏗️ Architecture

### Microservices

- **API Gateway**: Request routing, authentication, rate limiting
- **User Service**: User management, authentication, profiles
- **Message Service**: Real-time messaging, channels, file sharing
- **AI Service**: Intelligent assistant, summarization, content analysis

### Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Node.js (Express) + Python (FastAPI)
- **Database**: PostgreSQL + pgvector + Redis
- **Infrastructure**: Kubernetes (Minikube → AWS EKS)
- **Event System**: Redis Streams + Message Queues

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Minikube
- kubectl
- Node.js 18+
- Python 3.9+

### Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env and set appropriate values for your environment
```

### Local Development

```bash
# Start infrastructure services
docker-compose up -d postgres redis minio

# Start all services
npm run dev:all

# Or start services individually
npm run dev:user      # User Service (port 8001)
npm run dev:message   # Message Service (port 8002)
npm run dev:ai        # AI Service (port 8003)
npm run dev:gateway   # API Gateway (port 8080)
npm run dev:frontend  # Frontend (port 3000)
```

## 📁 Project Structure

```
echo/
├── services/                    # Independent microservices
│   ├── api-gateway/            # Node.js Express - Request routing
│   │   ├── src/
│   │   └── package.json
│   ├── user-service/           # Node.js Express - Authentication
│   │   ├── database/           # User service owns its database
│   │   ├── src/
│   │   └── package.json
│   ├── message-service/        # Node.js + Socket.io - Messaging
│   │   ├── database/           # Message service owns its database
│   │   ├── src/
│   │   └── package.json
│   └── ai-service/            # Python FastAPI - AI features
│       ├── database/           # AI service owns its database
│       ├── src/
│       └── requirements.txt
├── frontend/                   # React TypeScript
├── k8s/                       # Kubernetes manifests
│   ├── local/                 # Minikube development
│   └── production/            # AWS EKS production
├── scripts/                   # Development utilities
├── docs/                      # Architecture documentation
├── package.json               # Workspace orchestration
└── docker-compose.yml         # Local development stack
```

## 🔄 Event-Driven Architecture

```
Message Created → Event Bus → [AI Service, Notification Service, Search Indexer]
User Joined → Event Bus → [Welcome Bot, Analytics, Presence Tracker]
File Uploaded → Event Bus → [Virus Scanner, Thumbnail Generator]
```

## 📖 Documentation

- [API Documentation](./docs/api.md)
- [Deployment Guide](./docs/deployment.md)

## 🎯 Features

- ✅ Real-time messaging with WebSockets
- ✅ Event-driven microservices architecture
- ✅ AI-powered chat assistant
- ✅ File sharing with secure storage
- ✅ User presence and typing indicators
- ✅ Message threading and history
- ✅ Semantic search with vector database
- ✅ Desktop and email notifications

## 🛠️ Development

Each service can be developed independently:

```bash
# API Gateway
cd services/api-gateway && npm run dev

# User Service
cd services/user-service && npm run dev

# Message Service
cd services/message-service && npm run dev

# AI Service
cd services/ai-service && python -m uvicorn main:app --reload
```

## 📊 Monitoring

- Health checks: `/health` endpoint on all services
- Metrics: Prometheus integration
- Logging: Structured JSON logs
- Tracing: OpenTelemetry support

## 🌐 Deployment

- **Development**: Minikube with local storage
- **Production**: AWS EKS with RDS, ElastiCache, S3
- **CI/CD**: GitHub Actions for automated testing and deployment

---

Built with ❤️ as a portfolio project showcasing modern full-stack development practices.

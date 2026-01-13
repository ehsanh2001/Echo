# Echo - Local Kubernetes Development Environment

This directory contains all files needed for running Echo services in a local Minikube Kubernetes cluster.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HOST MACHINE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     DOCKER (docker-compose.infra.yml)               │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────┐  │    │
│  │  │  PostgreSQL  │  │    Redis     │  │  RabbitMQ    │  │MailHog  │  │    │
│  │  │  Port: 5433  │  │  Port: 6379  │  │  Port: 5672  │  │Port:1025│  │    │
│  │  │              │  │              │  │  UI: 15672   │  │UI: 8025 │  │    │
│  │  │  3 Databases │  │  Password    │  │  Metrics:    │  │         │  │    │
│  │  │  - users_db  │  │  protected   │  │  15692       │  │  Email  │  │    │
│  │  │  - wc_db     │  │              │  │              │  │  Test   │  │    │
│  │  │  - msg_db    │  │              │  │              │  │         │  │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └─────────┘  │    │
│  │         │                 │                 │               │       │    │
│  │         └─────────────────┴─────────────────┴───────────────┘       │    │
│  │                            Docker Volumes                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    │ host.minikube.internal                 │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         MINIKUBE CLUSTER                            │    │
│  │                                                                     │    │
│  │  ┌────────────────────────────────────────────────────────────────┐ │    │
│  │  │              echo namespace (Application Services)             │ │    │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │ │    │
│  │  │  │Frontend │ │  BFF    │ │  User   │ │Workspace│ │ Message │   │ │    │
│  │  │  │ :3000   │ │ :8004   │ │ :8001   │ │ :8002   │ │ :8003   │   │ │    │
│  │  │  └─────────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘   │ │    │
│  │  │                   │           │           │           │        │ │    │
│  │  │              ┌────┴───────────┴───────────┴───────────┘        │ │    │
│  │  │              │    ┌───────────────────┐                        │ │    │
│  │  │              │    │  Notification     │                        │ │    │
│  │  │              │    │  :8005            │                        │ │    │
│  │  │              │    └─────────┬─────────┘                        │ │    │
│  │  └──────────────┼──────────────┼──────────────────────────────────┘ │    │
│  │                 │              │                                    │    │
│  │                 │    OTLP Traces (/metrics endpoints)               │    │
│  │                 ▼              ▼                                    │    │
│  │  ┌────────────────────────────────────────────────────────────────┐ │    │
│  │  │          echo-observability namespace (Observability Stack)    │ │    │
│  │  │  ┌─────────────┐ ┌─────────┐ ┌─────────┐ ┌──────────────────┐  │ │    │
│  │  │  │OTel Collector│ │Prometheus│ │  Loki   │ │     Tempo       │  │ │    │
│  │  │  │ :4317/:4318 │ │  :9090  │ │ :3100   │ │     :3200       │  │ │    │
│  │  │  └──────┬──────┘ └────┬────┘ └────┬────┘ └────────┬────────┘  │ │    │
│  │  │         │             │           │               │           │ │    │
│  │  │         └─────────────┴───────────┴───────────────┘           │ │    │
│  │  │                              │                                 │ │    │
│  │  │                       ┌──────┴──────┐                          │ │    │
│  │  │                       │   Grafana   │                          │ │    │
│  │  │                       │    :3000    │                          │ │    │
│  │  │                       └─────────────┘                          │ │    │
│  │  └────────────────────────────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Docker Desktop installed and running
- Minikube installed
- kubectl installed

## Quick Start

### 1. Start Infrastructure Services

```bash
# Navigate to this directory
cd echo/k8s/local

# Start infrastructure (PostgreSQL, Redis, RabbitMQ, MailHog)
docker-compose -f docker-compose.infra.yml up -d

# Verify all services are healthy
docker-compose -f docker-compose.infra.yml ps
```

### 2. Start Minikube

```bash
# Start Minikube with Docker driver
minikube start --driver=docker

# Verify host.minikube.internal is accessible
minikube ssh "ping -c 3 host.minikube.internal"
```

### 3. Run Database Migrations

Before deploying services, run Prisma migrations:

```bash
# From the echo directory
cd ../..

# User Service
cd services/user-service
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/users_db" npx prisma migrate deploy
cd ../..

# Workspace-Channel Service
cd services/workspace-channel-service
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/workspace_channels_db" npx prisma migrate deploy
cd ../..

# Message Service
cd services/message-service
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/message_db" npx prisma migrate deploy
cd ../..
```

### 4. Build and Push Docker Images (Phase 2)

Before deploying to Minikube, you need to build Docker images and push them to Docker Hub so that Minikube can pull them.

#### Login to Docker Hub

```bash
# Login to Docker Hub with your credentials
docker login -u ehosseinipbox

# Enter your password when prompted
```

#### Build and Push All Services

```bash
# Navigate to k8s/local directory
cd k8s/local

# Option 1: Build and push all services for Minikube (default: api.echo.local)
./build-and-push.sh

# Option 2: Build specific service(s)
./build-and-push.sh frontend bff-service user-service

# Option 3: Build only (don't push to Docker Hub)
./build-and-push.sh --build-only

# Option 4: Build specific service without pushing
./build-and-push.sh --build-only user-service

# Option 5: Push only (if images already built)
./build-and-push.sh --push-only

# Option 6: Use custom tag instead of 'latest'
./build-and-push.sh --tag v1.0.0

# Option 7: Build frontend with custom API URL (for different environments)
./build-and-push.sh --api-url http://localhost:8004 frontend  # For local Docker dev
./build-and-push.sh --api-url http://api.echo.local frontend  # For Minikube (default)
```

> **Important:** The frontend's API URL is baked at build time (Next.js `NEXT_PUBLIC_*` variables).
> When building for Minikube, use `http://api.echo.local` (the default).
> If you change the ingress hostname, rebuild the frontend with the new URL.

#### Available Services

The script can build and push the following services:

- `frontend` → ehosseinipbox/echo-frontend:latest
- `bff-service` → ehosseinipbox/echo-bff:latest
- `user-service` → ehosseinipbox/echo-user:latest
- `workspace-channel-service` → ehosseinipbox/echo-workspace-channel:latest
- `message-service` → ehosseinipbox/echo-message:latest
- `notification-service` → ehosseinipbox/echo-notification:latest

#### Script Options

| Option         | Description                                   | Example                                        |
| -------------- | --------------------------------------------- | ---------------------------------------------- |
| (no options)   | Build and push all services with `latest` tag | `./build-and-push.sh`                          |
| `--build-only` | Build images locally without pushing          | `./build-and-push.sh --build-only`             |
| `--push-only`  | Push already-built images without rebuilding  | `./build-and-push.sh --push-only`              |
| `--tag <tag>`  | Use custom tag instead of `latest`            | `./build-and-push.sh --tag v1.0.0`             |
| `--api-url`    | Frontend API URL (default: api.echo.local)    | `./build-and-push.sh --api-url http://...`     |
| `--help`       | Display usage information                     | `./build-and-push.sh --help`                   |
| `<service>...` | Build/push specific services only             | `./build-and-push.sh user-service bff-service` |

#### Verify Images in Docker Hub

After pushing, verify your images at:

- https://hub.docker.com/r/ehosseinipbox/echo-frontend
- https://hub.docker.com/r/ehosseinipbox/echo-bff
- https://hub.docker.com/r/ehosseinipbox/echo-user
- https://hub.docker.com/r/ehosseinipbox/echo-workspace-channel
- https://hub.docker.com/r/ehosseinipbox/echo-message
- https://hub.docker.com/r/ehosseinipbox/echo-notification

### 5. Enable Minikube Ingress Addon

```bash
# Enable NGINX Ingress Controller
minikube addons enable ingress

# Verify ingress controller is running
kubectl get pods -n ingress-nginx
```

### 6. Generate Secrets (Phase 4)

Generate the Kubernetes secrets file for sensitive configuration:

```bash
# Navigate to secrets directory
cd k8s/local/secrets

# Generate secrets (uses passwords from docker-compose.infra.yml)
./generate-secrets.sh
```

This creates `echo-secrets.yaml` in the secrets directory. The file is gitignored and contains:

- JWT_SECRET
- Database URLs for all services
- Redis and RabbitMQ connection URLs
- RESEND_API_KEY (placeholder)

> **Important:** The generated secrets use passwords that match `docker-compose.infra.yml`. If you change infrastructure passwords, you must update both files.
>
> **Note:** Non-sensitive SMTP configuration (host, port) is in the ConfigMap.
> See [secrets/README.md](./secrets/README.md) for more details.

### 7. Deploy Application to Minikube (Phase 3 + 4)

Deploy all Echo services to the Minikube cluster using Kustomize:

```bash
# Navigate to echo directory
cd echo

# Preview what will be deployed (dry run)
kubectl kustomize k8s/local

# Apply all manifests (namespace, configmaps, secrets, deployments, services, ingress)
kubectl apply -k k8s/local

# Watch pods come up
kubectl get pods -n echo -w

# Check all resources
kubectl get all -n echo
```

#### Verify Deployment

```bash
# Check all pods are running
kubectl get pods -n echo

# Check services
kubectl get svc -n echo

# Check ingress
kubectl get ingress -n echo

# View logs for a specific service
kubectl logs -n echo -l app=user-service -f

# Describe a pod for troubleshooting
kubectl describe pod -n echo -l app=user-service
```

### 7. Configure Local DNS (Phase 5)

Add entries to your hosts file to access the application via hostname:

**Windows:** Edit `C:\Windows\System32\drivers\etc\hosts`  
**Linux/Mac:** Edit `/etc/hosts`

```bash
# Get Minikube IP
minikube ip

# Add to hosts file (replace <minikube-ip> with actual IP):
<minikube-ip> echo.local api.echo.local
```

**Alternative: Use Minikube Tunnel**

```bash
# In a separate terminal, start tunnel (requires admin/sudo)
minikube tunnel

# Then add to hosts file:
127.0.0.1 echo.local api.echo.local
```

### 8. Verify Ingress & External Access (Phase 5)

Verify the ingress is configured correctly and accessible:

```bash
# Check ingress status
kubectl get ingress -n echo

# Expected output:
# NAME           CLASS   HOSTS                       ADDRESS        PORTS   AGE
# echo-ingress   nginx   echo.local,api.echo.local   192.168.49.2   80      1m

# Describe ingress for details
kubectl describe ingress echo-ingress -n echo

# Verify the ingress controller is running
kubectl get pods -n ingress-nginx
```

#### Test Application Access

```bash
# Test frontend
curl -v http://echo.local

# Test BFF health endpoint
curl -v http://api.echo.local/health

# Test WebSocket handshake (Socket.IO)
curl "http://api.echo.local/socket.io/?EIO=4&transport=polling"

# Expected Socket.IO response (JSON):
# {"sid":"...","upgrades":["websocket"],"pingInterval":25000,"pingTimeout":60000}
```

### 9. Access the Application

Once deployed and DNS configured:

| Application | URL                   | Description               |
| ----------- | --------------------- | ------------------------- |
| Frontend    | http://echo.local     | Main application UI       |
| BFF API     | http://api.echo.local | Backend API and WebSocket |

### 10. Deploy Observability Stack (Phase 6)

The observability stack (Prometheus, Loki, Tempo, Grafana, OpenTelemetry Collector) is deployed into a separate `echo-observability` namespace. Since it uses a different namespace from the application, it must be deployed separately.

#### Deploy Observability

```bash
# Navigate to echo directory
cd echo

# Preview observability manifests (dry run)
kubectl kustomize k8s/base/observability

# Apply observability stack
kubectl apply -k k8s/base/observability

# Watch pods come up
kubectl get pods -n echo-observability -w
```

#### Verify Observability Deployment

```bash
# Check observability pods are running
kubectl get pods -n echo-observability

# Expected output:
# NAME                              READY   STATUS    RESTARTS   AGE
# grafana-xxxxx                     1/1     Running   0          1m
# loki-xxxxx                        1/1     Running   0          1m
# otel-collector-xxxxx              1/1     Running   0          1m
# prometheus-xxxxx                  1/1     Running   0          1m
# tempo-xxxxx                       1/1     Running   0          1m

# Check PVCs are bound
kubectl get pvc -n echo-observability

# Expected output:
# NAME              STATUS   VOLUME         CAPACITY   ACCESS MODES   STORAGECLASS
# loki-data         Bound    pvc-xxxx       10Gi       RWO            standard
# prometheus-data   Bound    pvc-xxxx       10Gi       RWO            standard
# tempo-data        Bound    pvc-xxxx       10Gi       RWO            standard

# Check services
kubectl get svc -n echo-observability
```

#### Configure DNS for Grafana

Add Grafana hostname to your hosts file:

**Windows:** Edit `C:\Windows\System32\drivers\etc\hosts`  
**Linux/Mac:** Edit `/etc/hosts`

```bash
# Add to hosts file (same IP as echo.local):
<minikube-ip> echo.local api.echo.local grafana.echo.local
```

#### Access Observability UIs

| Tool       | URL                       | Credentials      | Description                       |
| ---------- | ------------------------- | ---------------- | --------------------------------- |
| Grafana    | http://grafana.echo.local | admin / admin123 | Dashboards, logs, traces, metrics |
| Prometheus | Port-forward (see below)  | N/A              | Metrics query and targets         |
| Loki       | Port-forward (see below)  | N/A              | Log query (use via Grafana)       |
| Tempo      | Port-forward (see below)  | N/A              | Trace query (use via Grafana)     |

#### Port-Forward for Direct Access

```bash
# Grafana (if ingress not working)
kubectl port-forward -n echo-observability svc/grafana 3001:3000
# Access: http://localhost:3001

# Prometheus (check targets)
kubectl port-forward -n echo-observability svc/prometheus 9090:9090
# Access: http://localhost:9090/targets

# Loki (debug)
kubectl port-forward -n echo-observability svc/loki 3100:3100

# Tempo (debug)
kubectl port-forward -n echo-observability svc/tempo 3200:3200
```

#### Verify Prometheus Targets

1. Port-forward Prometheus: `kubectl port-forward -n echo-observability svc/prometheus 9090:9090`
2. Open http://localhost:9090/targets
3. All targets should show **UP** status:
   - `prometheus` (self)
   - `otel-collector`
   - `user-service`
   - `workspace-channel-service`
   - `message-service`
   - `bff-service`
   - `notification-service`
   - `rabbitmq`

#### Using Grafana

After login (admin / admin123):

1. **Explore Logs**: Click "Explore" → Select "Loki" datasource → Query logs
2. **Explore Traces**: Click "Explore" → Select "Tempo" datasource → Search for traces
3. **Explore Metrics**: Click "Explore" → Select "Prometheus" datasource → Run PromQL queries

**Example Queries:**

```promql
# Request rate per service
sum(rate(http_requests_total[5m])) by (service)

# 99th percentile latency
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service))
```

**Loki Log Query:**

```logql
{service="user-service"} |= "error"
```

#### Troubleshooting Observability

```bash
# Check OTel Collector logs (should show traces received)
kubectl logs -n echo-observability -l app=otel-collector -f

# Check if services are sending traces
# Look for OTEL_EXPORTER_OTLP_ENDPOINT in echo config
kubectl describe configmap echo-config -n echo | grep OTEL

# If PVCs are stuck in Pending, enable storage provisioner
minikube addons enable storage-provisioner
minikube addons enable default-storageclass
```

## Service Access

### From Host Machine

| Service             | URL                    | Credentials                   |
| ------------------- | ---------------------- | ----------------------------- |
| PostgreSQL          | localhost:5433         | postgres / postgres           |
| Redis               | localhost:6379         | password: dev-redis-password  |
| RabbitMQ Management | http://localhost:15672 | admin / dev-rabbitmq-password |
| MailHog UI          | http://localhost:8025  | N/A                           |

### From Minikube Pods

| Service    | URL                                                               |
| ---------- | ----------------------------------------------------------------- |
| PostgreSQL | `postgresql://postgres:postgres@host.minikube.internal:5433/<db>` |
| Redis      | `redis://:dev-redis-password@host.minikube.internal:6379`         |
| RabbitMQ   | `amqp://admin:dev-rabbitmq-password@host.minikube.internal:5672`  |
| MailHog    | `smtp://host.minikube.internal:1025`                              |

## Commands Reference

### Infrastructure Management

```bash
# Start all services
docker-compose -f docker-compose.infra.yml up -d

# Stop services (keeps data)
docker-compose -f docker-compose.infra.yml down

# Stop and remove all data (CAUTION!)
docker-compose -f docker-compose.infra.yml down -v

# View logs
docker-compose -f docker-compose.infra.yml logs -f

# View logs for specific service
docker-compose -f docker-compose.infra.yml logs -f postgres

# Restart a service
docker-compose -f docker-compose.infra.yml restart redis
```

### Database Operations

```bash
# Connect to PostgreSQL
docker exec -it echo-k8s-postgres psql -U postgres

# List databases
docker exec -it echo-k8s-postgres psql -U postgres -c "\l"

# Connect to specific database
docker exec -it echo-k8s-postgres psql -U postgres -d users_db
```

### Redis Operations

```bash
# Connect to Redis CLI
docker exec -it echo-k8s-redis redis-cli -a dev-redis-password

# Check Redis info
docker exec -it echo-k8s-redis redis-cli -a dev-redis-password INFO
```

### Minikube Operations

```bash
# Check Minikube status
minikube status

# SSH into Minikube node
minikube ssh

# Test connectivity to host services (from inside Minikube)
minikube ssh "nc -zv host.minikube.internal 5432"
minikube ssh "nc -zv host.minikube.internal 6379"
minikube ssh "nc -zv host.minikube.internal 5672"
```

## Troubleshooting

### Issue: Minikube Cannot Connect to Host Services

**Symptoms:** Connection refused or timeout from pods

**Solutions:**

1. Verify Docker services are running:

   ```bash
   docker-compose -f docker-compose.infra.yml ps
   ```

2. Check host.minikube.internal resolves:

   ```bash
   minikube ssh "ping -c 3 host.minikube.internal"
   ```

3. Verify ports are not blocked by firewall (Windows):
   - Open Windows Defender Firewall
   - Allow Docker Desktop through firewall
   - Ensure ports 5432, 6379, 5672, 1025 are accessible

4. Restart Minikube:
   ```bash
   minikube stop
   minikube start --driver=docker
   ```

### Issue: Databases Not Created

**Symptoms:** `database "users_db" does not exist`

**Solutions:**

1. Check if init script ran:

   ```bash
   docker logs echo-k8s-postgres | grep "CREATE DATABASE"
   ```

2. Manually create databases:

   ```bash
   docker exec -it echo-k8s-postgres psql -U postgres -c "CREATE DATABASE users_db;"
   docker exec -it echo-k8s-postgres psql -U postgres -c "CREATE DATABASE workspace_channels_db;"
   docker exec -it echo-k8s-postgres psql -U postgres -c "CREATE DATABASE message_db;"
   ```

3. Reset PostgreSQL (destroys all data):
   ```bash
   docker-compose -f docker-compose.infra.yml down -v
   docker-compose -f docker-compose.infra.yml up -d
   ```

### Issue: Port Already in Use

**Symptoms:** `Error: bind: address already in use`

**Solutions:**

1. Check what's using the port:

   ```bash
   # Windows PowerShell
   netstat -ano | findstr :5432

   # Linux/Mac
   lsof -i :5432
   ```

2. Use alternative ports in `.env.infra.local`:
   ```bash
   POSTGRES_PORT=5433
   REDIS_PORT=6380
   ```

## Files in This Directory

| File                     | Description                                               |
| ------------------------ | --------------------------------------------------------- |
| docker-compose.infra.yml | Infrastructure services for Minikube                      |
| init-databases.sql       | PostgreSQL initialization script                          |
| .env.infra               | Default environment variables for infrastructure          |
| build-and-push.sh        | Build and push Docker images to Docker Hub                |
| kustomization.yaml       | Kustomize overlay for local environment                   |
| secrets/                 | Generated secrets directory (gitignored)                  |
| ingress.yaml             | NGINX Ingress configuration with WebSocket support        |
| ../base/observability/   | Observability stack manifests (Grafana, Prometheus, etc.) |
| README.md                | This file                                                 |

## Kubernetes Commands Reference

### Deployment Management

```bash
# Apply/update all application manifests
kubectl apply -k k8s/local

# Apply/update observability stack
kubectl apply -k k8s/base/observability

# Delete all application resources
kubectl delete -k k8s/local

# Delete observability resources
kubectl delete -k k8s/base/observability

# Or delete entire namespaces (removes everything)
kubectl delete namespace echo
kubectl delete namespace echo-observability

# Restart a deployment (pulls new images)
kubectl rollout restart deployment/user-service -n echo

# Scale a deployment
kubectl scale deployment/user-service -n echo --replicas=2

# Check rollout status
kubectl rollout status deployment/user-service -n echo
```

### Debugging

```bash
# Get pod logs
kubectl logs -n echo -l app=bff-service -f

# Get previous container logs (after crash)
kubectl logs -n echo <pod-name> --previous

# Exec into a pod
kubectl exec -it -n echo <pod-name> -- sh

# Port forward for direct access (bypass ingress)
kubectl port-forward -n echo svc/user-service 8001:8001
kubectl port-forward -n echo svc/bff-service 8004:8004
kubectl port-forward -n echo svc/frontend 3000:3000

# Test internal service connectivity
kubectl run test-pod --image=busybox -n echo --rm -it --restart=Never -- \
  wget -qO- http://user-service:8001/api/users/health
```

### Resource Monitoring

```bash
# Check resource usage
kubectl top pods -n echo

# Describe resources for details
kubectl describe deployment/user-service -n echo
kubectl describe pod -n echo -l app=user-service
kubectl describe ingress -n echo
```

## Next Steps

After application is deployed:

1. ✅ Phase 1: Infrastructure for Minikube (completed)
2. ✅ Phase 2: Build and push images to Docker Hub (completed)
3. ✅ Phase 3: Deploy application to Minikube (completed)
4. ✅ Phase 4: Configure Kubernetes Secrets (completed)
5. ✅ Phase 5: Ingress & External Access (completed)
6. ✅ Phase 6: Deploy observability stack (completed)
7. Phase 7: Set up CI/CD pipeline
8. Phase 8: AWS Production Deployment

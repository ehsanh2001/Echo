# Kubernetes Secrets for Local Minikube Deployment

This directory contains secret manifests that should **NEVER** be committed to Git.

## Quick Start

1. Generate the secrets file:

   ```bash
   ./generate-secrets.sh
   ```

2. Apply the secrets:

   ```bash
   kubectl apply -f echo-secrets.yaml
   ```

3. Deploy the application:
   ```bash
   cd ..
   kubectl apply -k .
   ```

## Manual Creation (Alternative)

If you prefer not to use the script, create secrets using `kubectl`:

```bash
# Create namespace first (if not exists)
kubectl create namespace echo --dry-run=client -o yaml | kubectl apply -f -

# Create secret from literal values
kubectl create secret generic echo-secrets \
  --namespace=echo \
  --from-literal=JWT_SECRET='your-super-secure-jwt-secret-key-at-least-32-chars-long' \
  --from-literal=USER_SERVICE_DATABASE_URL='postgresql://postgres:postgres@host.minikube.internal:5433/users_db?schema=public' \
  --from-literal=WC_SERVICE_DATABASE_URL='postgresql://postgres:postgres@host.minikube.internal:5433/workspace_channels_db?schema=public' \
  --from-literal=MESSAGE_SERVICE_DATABASE_URL='postgresql://postgres:postgres@host.minikube.internal:5433/message_db?schema=public' \
  --from-literal=REDIS_URL='redis://:dev-redis-password@host.minikube.internal:6379' \
  --from-literal=RABBITMQ_URL='amqp://admin:dev-rabbitmq-password@host.minikube.internal:5672' \
  --from-literal=RESEND_API_KEY='re_placeholder_not_used_in_local'
```

## Customizing Values

⚠️ **IMPORTANT:** If you modify passwords in `generate-secrets.sh`, you **MUST** also update the corresponding values in `docker-compose.infra.yml`:

- `JWT_SECRET` - JWT signing key (min 32 characters, only used by K8s services)
- `POSTGRES_PASSWORD` - Must match `POSTGRES_PASSWORD` in docker-compose.infra.yml
- `REDIS_PASSWORD` - Must match `REDIS_PASSWORD` in docker-compose.infra.yml
- `RABBITMQ_PASSWORD` - Must match `RABBITMQ_DEFAULT_PASS` in docker-compose.infra.yml

The infrastructure services (PostgreSQL, Redis, RabbitMQ) run in Docker outside Kubernetes, so both configurations must use the same passwords.

## Verify Secrets

```bash
# List secrets
kubectl get secrets -n echo

# Describe secret (shows keys, not values)
kubectl describe secret echo-secrets -n echo

# Decode a specific value (for debugging only!)
kubectl get secret echo-secrets -n echo -o jsonpath='{.data.JWT_SECRET}' | base64 -d
```

## Infrastructure Connection

Secrets connect to infrastructure services running in Docker (via `docker-compose.infra.yml`):

| Service    | Host                   | Port |
| ---------- | ---------------------- | ---- |
| PostgreSQL | host.minikube.internal | 5433 |
| Redis      | host.minikube.internal | 6379 |
| RabbitMQ   | host.minikube.internal | 5672 |

## Production Secrets

For AWS production deployment, secrets are managed via **AWS Secrets Manager**.
See [Phase 8.4: Container Registry & Secrets](../../../../phase-8-4-ecr-secrets.md) for details.

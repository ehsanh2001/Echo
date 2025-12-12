# Grafana Logging Stack - Quick Start Guide

## ✅ What's Been Set Up

### Infrastructure

- **Loki** (port 3100) - Log aggregation and storage
- **Promtail** - Automatically collects logs from Docker containers
- **Grafana** (port **3001**) - Log visualization and querying

### Configuration Changes

- **Logger package** - Disabled file logging by default (logs go to stdout)
- **Docker Compose** - Added Grafana stack with 7-day log retention
- **Promtail** - Configured to scrape logs from echo services only

---

## 🚀 Access Grafana

1. **Open Grafana**: http://localhost:3001
2. **Login credentials**:
   - Username: `admin`
   - Password: `admin`
3. **On first login**: You'll be prompted to change the password (optional for development)

---

## 📊 Using Grafana

### 1. View the Pre-built Dashboard

- Go to **Dashboards** → **Echo Services - Logs Overview**
- This dashboard shows:
  - All service logs (live streaming)
  - Error logs only
  - Log volume by service

### 2. Explore Logs Manually

- Click **Explore** (compass icon) in the left sidebar
- Loki is already configured as the default datasource

### 3. Example Queries

**All logs from a specific service:**

```logql
{service="user-service"}
```

**All error logs across services:**

```logql
{service=~".+"} |= "error"
```

**Logs for a specific correlation ID:**

```logql
{service=~".+"} | json | correlationId="req-abc123"
```

**Logs for a specific user:**

```logql
{service=~".+"} | json | userId="user-456"
```

**Logs from a specific instance:**

```logql
{service=~".+"} | json | instanceId="echo-user-service"
```

**Error rate by service (last 5 minutes):**

```logql
sum by (service) (rate({service=~".+"} |= "error" [5m]))
```

---

## 🔍 Testing the Setup

### 1. Start Your Services

```bash
cd /c/MyFiles/code/Projects/MySlack/echo
docker-compose up -d
```

### 2. Generate Some Logs

Make API requests to your services:

```bash
# Create a user
curl -X POST http://localhost:8001/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"password123"}'
```

### 3. View Logs in Grafana

- Go to Grafana at http://localhost:3001
- Click **Explore**
- Run query: `{service="user-service"}`
- You should see logs with:
  - `instanceId`: Your container hostname
  - `correlationId`: Request correlation ID
  - `level`: info, error, warn, etc.
  - `service`: user-service
  - `message`: Log message

---

## 📁 File Structure

```
echo/
├── docker-compose.yml                    # Updated with Grafana stack
├── docker/
│   ├── loki/
│   │   └── loki-config.yaml             # Loki storage & retention config
│   ├── promtail/
│   │   └── promtail-config.yaml         # Log collection & parsing config
│   └── grafana/
│       └── provisioning/
│           ├── datasources/
│           │   └── loki.yaml            # Loki datasource auto-config
│           └── dashboards/
│               ├── dashboard.yaml        # Dashboard provider config
│               └── service-logs-dashboard.json  # Pre-built dashboard
└── services/shared/logger/
    └── src/config.ts                     # Updated: file logging disabled
```

---

## 🔧 Useful Commands

### Check Logging Stack Status

```bash
docker-compose ps loki promtail grafana
```

### View Promtail Logs (troubleshooting)

```bash
docker-compose logs -f promtail
```

### View Loki Logs

```bash
docker-compose logs -f loki
```

### Restart Logging Stack

```bash
docker-compose restart loki promtail grafana
```

### Stop Logging Stack

```bash
docker-compose stop loki promtail grafana
```

---

## 🎯 Key Features

### Automatic Log Collection

- Promtail automatically discovers and scrapes logs from all `echo-*` containers
- No code changes required in services
- Logs are parsed as JSON automatically

### Structured Metadata

Every log entry includes:

- `service` - Which service produced the log
- `instanceId` - Container/pod identifier
- `correlationId` - Request tracking ID
- `userId`, `workspaceId`, `channelId` - Business context
- `level` - Log level (info, error, warn, etc.)
- `timestamp` - Precise time

### Retention

- Logs are retained for **7 days** by default
- Can be configured in `docker/loki/loki-config.yaml`

---

## 🐛 Troubleshooting

### No logs appearing in Grafana?

1. **Check Promtail is collecting logs:**

   ```bash
   docker-compose logs promtail | grep "Successfully sent batch"
   ```

2. **Check your services are running:**

   ```bash
   docker-compose ps
   ```

3. **Verify container names start with "echo-":**

   ```bash
   docker ps --format "{{.Names}}" | grep echo
   ```

4. **Check Promtail can reach Loki:**
   ```bash
   docker-compose exec promtail wget -qO- http://loki:3100/ready
   ```

### Grafana not loading?

1. **Check Grafana is running:**

   ```bash
   docker-compose logs grafana
   ```

2. **Verify port 3001 is not in use:**
   ```bash
   netstat -an | grep 3001
   ```

### Want to see raw logs?

Your services still output to stdout, accessible via:

```bash
docker-compose logs -f user-service
docker-compose logs -f message-service
```

---

## 🔄 Next Steps

1. ✅ Access Grafana at http://localhost:3001
2. ✅ View the pre-built dashboard
3. ✅ Try the example queries in Explore
4. ✅ Make API calls and watch logs appear in real-time
5. Create custom dashboards for your team
6. Set up alerting rules (optional)
7. Add more panels to track specific metrics

---

## 📚 Useful Query Tips

### Filter by Time Range

Use the time picker in the top right to narrow your search

### Combine Filters

```logql
{service="user-service"} |= "error" | json | userId="user-123"
```

### Count Errors

```logql
sum(count_over_time({service=~".+"} |= "error" [1h]))
```

### Find Slow Requests

```logql
{service=~".+"} | json | duration > 1000
```

---

## 🎉 Success Indicators

You'll know everything is working when:

- ✅ Grafana loads at http://localhost:3001
- ✅ Loki datasource shows as connected
- ✅ "Echo Services - Logs Overview" dashboard displays logs
- ✅ Logs include `instanceId`, `correlationId`, and other metadata
- ✅ You can filter logs by service, correlation ID, or user ID

**Your logging stack is now ready! 🚀**

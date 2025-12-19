# ==================================
# Stage 1: Builder - Bundle the application
# ==================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy shared packages (needed for building)
COPY services/shared ./services/shared/

# Install dependencies for shared packages
RUN cd services/shared/telemetry && npm install
RUN cd services/shared/logger && npm install
RUN cd services/shared/metrics && npm install
RUN cd services/shared/http-client && npm install

# Now set up the service
WORKDIR /app/services/notification-service

# Copy service package files
COPY services/notification-service/package*.json ./
COPY services/notification-service/tsup.config.ts ./

# Install service dependencies
RUN npm install

# Copy source code
COPY services/notification-service/src ./src/
COPY services/notification-service/tsconfig.json ./

# Bundle with tsup
RUN npm run build

# ==================================
# Stage 2: Production - Minimal runtime (no node_modules!)
# ==================================
FROM node:22-alpine AS production

RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app
RUN chown nodejs:nodejs /app

USER nodejs

# Copy ONLY the bundled application
COPY --chown=nodejs:nodejs --from=builder /app/services/notification-service/dist ./dist
COPY --chown=nodejs:nodejs services/notification-service/package.json ./

# Copy email templates to match the path resolution in TemplateService
# TemplateService uses: path.join(__dirname, "..", "templates")
# Since __dirname is /app/dist after bundling, it looks for /app/templates
COPY --chown=nodejs:nodejs services/notification-service/src/templates ./templates

EXPOSE 8005

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8005/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]

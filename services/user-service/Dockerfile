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
WORKDIR /app/services/user-service

# Copy service package files and prisma schema
COPY services/user-service/package*.json ./
COPY services/user-service/tsup.config.ts ./
COPY services/user-service/prisma ./prisma/

# Install service dependencies
RUN npm install

# Copy source code
COPY services/user-service/src ./src/
COPY services/user-service/tsconfig.json ./

# Bundle with tsup (includes prisma generate)
RUN npm run build

# Prune to production deps only (keeps @prisma/client)
RUN npm prune --omit=dev

# ==================================
# Stage 2: Production - Minimal runtime
# ==================================
FROM node:22-alpine AS production

RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app
RUN chown nodejs:nodejs /app

USER nodejs

# Copy bundled application
COPY --chown=nodejs:nodejs --from=builder /app/services/user-service/dist ./dist
COPY --chown=nodejs:nodejs services/user-service/package.json ./

# Copy only Prisma client from node_modules (required - native binaries)
COPY --chown=nodejs:nodejs --from=builder /app/services/user-service/node_modules/.prisma ./node_modules/.prisma
COPY --chown=nodejs:nodejs --from=builder /app/services/user-service/node_modules/@prisma ./node_modules/@prisma

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8001/api/users/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]

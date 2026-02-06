# ==================================
# Stage 1: Builder - Bundle the application
# ==================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy shared packages (needed for building)
COPY services/shared ./services/shared/

# Install and build shared packages (tsc needs .d.ts files in dist/)
RUN cd services/shared/telemetry && npm install && npm run build
RUN cd services/shared/logger && npm install && npm run build
RUN cd services/shared/metrics && npm install && npm run build
RUN cd services/shared/http-client && npm install && npm run build

# Now set up the service
WORKDIR /app/services/workspace-channel-service

# Copy service package files and prisma schema
COPY services/workspace-channel-service/package*.json ./
COPY services/workspace-channel-service/tsup.config.ts ./
COPY services/workspace-channel-service/tsconfig.json ./
COPY services/workspace-channel-service/tsconfig.build.json ./
COPY services/workspace-channel-service/prisma ./prisma/

# Install service dependencies
RUN npm install

# Copy source code
COPY services/workspace-channel-service/src ./src/

# Build: prisma generate, tsc (for decorator metadata), then tsup bundle
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
COPY --chown=nodejs:nodejs --from=builder /app/services/workspace-channel-service/dist ./dist
COPY --chown=nodejs:nodejs services/workspace-channel-service/package.json ./

# Copy only Prisma client from node_modules (required - native binaries)
COPY --chown=nodejs:nodejs --from=builder /app/services/workspace-channel-service/node_modules/.prisma ./node_modules/.prisma
COPY --chown=nodejs:nodejs --from=builder /app/services/workspace-channel-service/node_modules/@prisma ./node_modules/@prisma

EXPOSE 8002

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8002/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]

# ==================================
# Stage 1: Builder - Build the application
# ==================================
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

COPY package*.json ./
COPY services/shared ./services/shared/

# Copy package files for dependency installation
# Copying separately to leverage Docker layer caching
COPY services/workspace-channel-service/package*.json ./services/workspace-channel-service/
COPY services/workspace-channel-service/prisma ./services/workspace-channel-service/prisma/

# Install ALL dependencies (including devDependencies for building)
RUN cd services/workspace-channel-service && npm install

# Copy source code
COPY services/workspace-channel-service/src ./services/workspace-channel-service/src/
COPY services/workspace-channel-service/tsconfig.json ./services/workspace-channel-service/

# Generate Prisma Client
RUN cd services/workspace-channel-service && npx prisma generate

# Build TypeScript to JavaScript
RUN cd services/workspace-channel-service && npm run build

# ==================================
# Stage 2: Production - Runtime image
# ==================================
FROM node:22-alpine AS production

# Set working directory
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

COPY package*.json ./
COPY services/shared ./services/shared/

# Copy package files
COPY services/workspace-channel-service/package*.json ./services/workspace-channel-service/

# Copy Prisma schema for runtime client generation
COPY services/workspace-channel-service/prisma ./services/workspace-channel-service/prisma/

# Install ONLY production dependencies
RUN cd services/workspace-channel-service && npm install --omit=dev && npm cache clean --force

# Generate Prisma Client (needed for production)
RUN cd services/workspace-channel-service && npx prisma generate

# Copy built application from builder stage
COPY --from=builder /app/services/workspace-channel-service/dist ./services/workspace-channel-service/dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of app files to non-root user
RUN chown -R nodejs:nodejs /app

WORKDIR /app/services/workspace-channel-service

# Switch to non-root user
USER nodejs

# Expose the application port
EXPOSE 8002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8002/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]

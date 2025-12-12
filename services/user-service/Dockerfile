# ==================================
# Stage 1: Builder - Build the application
# ==================================
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy workspace package.json and shared packages first
COPY package*.json ./
COPY services/shared ./services/shared/

# Copy service-specific files
COPY services/user-service/package*.json ./services/user-service/
COPY services/user-service/prisma ./services/user-service/prisma/

# Install ALL dependencies (including devDependencies for building)
RUN cd services/user-service && npm install

# Copy source code
COPY services/user-service/src ./services/user-service/src/
COPY services/user-service/tsconfig.json ./services/user-service/

# Generate Prisma Client
RUN cd services/user-service && npx prisma generate

# Build TypeScript to JavaScript
RUN cd services/user-service && npm run build

# ==================================
# Stage 2: Production - Runtime image
# ==================================
FROM node:22-alpine AS production

# Set working directory
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy workspace and service package files
COPY package*.json ./
COPY services/shared ./services/shared/
COPY services/user-service/package*.json ./services/user-service/
COPY services/user-service/prisma ./services/user-service/prisma/

# Install ONLY production dependencies
RUN cd services/user-service && npm install --omit=dev && \
    npm cache clean --force

# Generate Prisma Client (needed for production)
RUN cd services/user-service && npx prisma generate

# Copy built application from builder stage
COPY --from=builder /app/services/user-service/dist ./services/user-service/dist

# Set working directory to service directory
WORKDIR /app/services/user-service

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of app files to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose the application port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]

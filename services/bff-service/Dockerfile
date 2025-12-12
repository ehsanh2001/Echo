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
COPY services/bff-service/package*.json ./services/bff-service/

# Install ALL dependencies (including devDependencies for building)
RUN cd services/bff-service && npm install

# Copy source code
COPY services/bff-service/src ./services/bff-service/src/
COPY services/bff-service/tsconfig.json ./services/bff-service/

# Build TypeScript to JavaScript
RUN cd services/bff-service && npm run build

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
COPY services/bff-service/package*.json ./services/bff-service/

# Install ONLY production dependencies
RUN cd services/bff-service && npm install --omit=dev && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/services/bff-service/dist ./services/bff-service/dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of app files to non-root user
RUN chown -R nodejs:nodejs /app

WORKDIR /app/services/bff-service

# Switch to non-root user
USER nodejs

# Expose the application port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]

# ==================================
# Stage 1: Builder - Build the application
# ==================================
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy workspace and shared packages
COPY package*.json ./
COPY services/shared ./services/shared/

# Copy service-specific files
COPY services/notification-service/package*.json ./services/notification-service/

# Install ALL dependencies (including devDependencies for building)
RUN cd services/notification-service && npm install

# Copy source code
COPY services/notification-service/src ./services/notification-service/src/
COPY services/notification-service/tsconfig.json ./services/notification-service/

# Build TypeScript to JavaScript
RUN cd services/notification-service && npm run build

# ==================================
# Stage 2: Production - Runtime image
# ==================================
FROM node:22-alpine AS production

# Set working directory
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy workspace and shared packages
COPY package*.json ./
COPY services/shared ./services/shared/

# Copy service-specific files
COPY services/notification-service/package*.json ./services/notification-service/

# Install ONLY production dependencies
RUN cd services/notification-service && npm install --omit=dev && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/services/notification-service/dist ./services/notification-service/dist

# Copy email templates
COPY services/notification-service/src/templates ./services/notification-service/dist/templates

# Set working directory to service
WORKDIR /app/services/notification-service

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 8005

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]

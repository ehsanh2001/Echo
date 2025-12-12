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
COPY services/message-service/package*.json ./services/message-service/
COPY services/message-service/prisma ./services/message-service/prisma/

# Install ALL dependencies (including devDependencies for building)
RUN cd services/message-service && npm install

# Copy source code
COPY services/message-service/src ./services/message-service/src/
COPY services/message-service/tsconfig.json ./services/message-service/

# Generate Prisma Client
RUN cd services/message-service && npx prisma generate

# Build TypeScript to JavaScript
RUN cd services/message-service && npm run build

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
COPY services/message-service/package*.json ./services/message-service/

# Copy Prisma schema for runtime client generation
COPY services/message-service/prisma ./services/message-service/prisma/

# Install ONLY production dependencies
RUN cd services/message-service && npm install --omit=dev && npm cache clean --force

# Generate Prisma Client (needed for production)
RUN cd services/message-service && npx prisma generate

# Copy built application from builder stage
COPY --from=builder /app/services/message-service/dist ./services/message-service/dist

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app

WORKDIR /app/services/message-service

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 8003

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]

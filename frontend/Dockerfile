# Multi-stage build for Next.js frontend

# Stage 1: Builder
FROM node:22-alpine AS builder
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1

# Build arguments for NEXT_PUBLIC_ variables (required at build time)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BFF_URL
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_MAX_MESSAGE_LENGTH
ARG NEXT_PUBLIC_FARO_COLLECTOR_URL
ARG NEXT_PUBLIC_APP_VERSION
ARG NEXT_PUBLIC_APP_ENVIRONMENT

# Set as environment variables for the build
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_BFF_URL=$NEXT_PUBLIC_BFF_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_MAX_MESSAGE_LENGTH=$NEXT_PUBLIC_MAX_MESSAGE_LENGTH
ENV NEXT_PUBLIC_FARO_COLLECTOR_URL=$NEXT_PUBLIC_FARO_COLLECTOR_URL
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION
ENV NEXT_PUBLIC_APP_ENVIRONMENT=$NEXT_PUBLIC_APP_ENVIRONMENT

# Build the application
RUN npm run build

# Stage 2: Runner
FROM node:22-alpine AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user BEFORE copying files
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

WORKDIR /app
RUN chown nextjs:nodejs /app

USER nextjs

# Copy necessary files from builder with correct ownership
COPY --chown=nextjs:nodejs --from=builder /app/public ./public
COPY --chown=nextjs:nodejs --from=builder /app/.next/standalone ./
COPY --chown=nextjs:nodejs --from=builder /app/.next/static ./.next/static

EXPOSE 3000

ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

CMD ["node", "server.js"]

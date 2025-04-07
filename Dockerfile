# Stage 1: Build environment
FROM node:18.20.3-alpine AS builder

# Install build tools
RUN apk add --no-cache python3 make g++ curl

# Install wait-for script for database dependency check
RUN curl -o /usr/local/bin/wait-for https://github.com/eficode/wait-for/releases/download/v2.2.3/wait-for && \
    chmod +x /usr/local/bin/wait-for

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install all dependencies including devDependencies
RUN npm ci --include=dev

# Copy source files
COPY . .

# Build application
RUN npm run build

# Stage 2: Production environment
FROM node:18.20.3-alpine

# Set production environment variables
ENV NODE_ENV=production
ENV MYSQL_HOST=mysql-service.crda-namespace.svc.cluster.local
ENV MYSQL_USER=app_user
ENV MYSQL_DATABASE=base_crda
ENV MYSQL_PORT=3306

WORKDIR /app

# Copy package files from builder
COPY --from=builder /app/package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built assets from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.env ./
COPY --from=builder /app/app.js ./
COPY --from=builder /app/views ./views
COPY --from=builder /app/utils ./utils

# Copy wait-for script from builder
COPY --from=builder /usr/local/bin/wait-for /usr/local/bin/wait-for

# Create non-root user and set permissions
RUN addgroup -S appgroup && \
    adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

# Wait for MySQL to be ready before starting
CMD ["sh", "-c", "wait-for $MYSQL_HOST:$MYSQL_PORT --timeout=300 -- node app.js"]
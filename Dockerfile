FROM node:18.20.3-alpine

# Install system dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install production dependencies first
RUN npm ci --only=production

# Install development dependencies separately
RUN npm ci --only=development

# Copy application files
COPY . .

# Build application (if needed)
RUN npm run build

# Cleanup development dependencies for production image
RUN npm prune --production

EXPOSE 4200
CMD ["node", "app.js"]
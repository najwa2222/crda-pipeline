FROM node:18.20.3-alpine

# Install Python and build tools
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./

# Install both production and development dependencies
RUN npm ci --include=dev

COPY . .

# Build application
RUN npm run build

# Clean dev dependencies
RUN npm prune --omit=dev

EXPOSE 3000

CMD ["node", "app.js"]
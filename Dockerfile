FROM node:18.20.1

# Install system build dependencies
RUN apt-get update && \
    apt-get install -y python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install global dependencies first
RUN npm install -g node-gyp node-pre-gyp

# Copy package files
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy application files
COPY . .

EXPOSE 3000
CMD ["node", "app.js"]
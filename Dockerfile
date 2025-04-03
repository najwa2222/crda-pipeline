FROM node:18.20.1

WORKDIR /app

# Install system build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install global npm packages for native modules
RUN npm install -g node-gyp node-pre-gyp

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "app.js"]
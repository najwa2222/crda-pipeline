FROM node:14

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

# Copy all files with proper directory structure
COPY views/ ./views/
COPY public/ ./public/
COPY app.js ./

EXPOSE 4200
CMD ["node", "app.js", "--host", "0.0.0.0"]

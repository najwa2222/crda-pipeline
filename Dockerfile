FROM node:14.20.1

WORKDIR C:\\app
COPY package*.json ./
RUN npm install --production

COPY views/ ./views/
COPY public/ ./public/
COPY app.js .

EXPOSE 4200
CMD ["node", "app.js"]
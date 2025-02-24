FROM node:16-alpine

# Installer SQLite et Redis (redis-cli est inclus dans le package redis)
RUN apk add --no-cache sqlite redis

# Script de démarrage pour lancer Redis et Node
COPY start.sh /start.sh
RUN chmod +x /start.sh

WORKDIR /app

COPY ./tools/package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["/start.sh"]

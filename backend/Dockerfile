FROM node:16-alpine

# Installer SQLite et Redis (redis-cli est inclus dans le package redis)
RUN apk add --no-cache sqlite redis

WORKDIR /app

# Copier package.json et package-lock.json
COPY ./tools/package*.json ./

# Installer les dépendances, y compris ws explicitement
RUN npm install --production && \
    npm install ws@8.13.0 --save

# Copier le reste des fichiers de l'application
COPY . .

# Script de démarrage pour lancer Redis et Node
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 3000

CMD ["/start.sh"]

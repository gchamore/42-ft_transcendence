FROM node:16-alpine

# Installer SQLite et Redis
RUN apk add --no-cache sqlite redis

WORKDIR /app

# Copier package.json et package-lock.json
COPY ./tools/package*.json ./

# Installer les dépendances
RUN npm install --production

# Copier le reste des fichiers de l'application
COPY . .

# Créer les dossiers de stockage
RUN mkdir -p /data/avatar && chown -R node:node /data

# Script de démarrage pour lancer Redis et Node
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 3000

CMD ["/start.sh"]

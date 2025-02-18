FROM node:16-alpine

WORKDIR /app

COPY ./tools/package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]

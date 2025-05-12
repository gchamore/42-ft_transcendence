FROM nginx:alpine

# Ajouter openssl via apk (le gestionnaire de paquets Alpine)
RUN apk add --no-cache openssl

# Crée le dossier pour les certificats
RUN mkdir -p /etc/nginx/certs

# Génère le certificat auto-signé
RUN openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout /etc/nginx/certs/selfsigned.key \
  -out /etc/nginx/certs/selfsigned.crt \
  -subj "/C=FR/ST=Paris/L=Paris/O=42/OU=Student/CN=localhost"

# Copie la config nginx
COPY nginx.conf /etc/nginx/nginx.conf

CMD ["sh", "-c", "envsubst '${NGROK_URL}' < /etc/nginx/nginx.conf > /etc/nginx/nginx.generated.conf && mv /etc/nginx/nginx.generated.conf /etc/nginx/nginx.conf && nginx -g 'daemon off;'"]

#!/bin/sh

# Fonction de nettoyage
cleanup() {
    echo "Arrêt des services..."
    kill $(jobs -p)
    wait
    exit 0
}

# Capture des signaux
trap cleanup SIGTERM SIGINT

# Démarrage de Redis en arrière-plan
redis-server --daemonize yes

# Démarrage de l'application Node
node server.js &

# Attente des processus en arrière-plan
wait

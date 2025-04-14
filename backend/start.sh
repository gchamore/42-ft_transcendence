#!/bin/sh

# Cleanup function
cleanup() {
    echo "Arrêt des services..."
    kill $(jobs -p)
    wait
    exit 0
}

# Capture signals
trap cleanup SIGTERM SIGINT

# Start Redis in the background
redis-server --daemonize yes

# Node application startup
node server.js &

# Background process waiting
wait

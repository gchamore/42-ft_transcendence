async function routes(fastify, options) {
    fastify.get('/ws', { websocket: true }, (connection, req) => {
        const userId = req.user?.userId;
        if (!userId) {
            connection.socket.close();
            return;
        }

        fastify.log.info(`WebSocket connection established for user: ${userId}`);
        fastify.connections.set(userId, connection.socket);

        // Configurer le ping-pong
        const pingInterval = setInterval(() => {
            if (connection.socket.readyState === 1) { // 1 = OPEN
                connection.socket.ping();
            }
        }, 30000); // Ping toutes les 30 secondes

        connection.socket.on('pong', () => {
            fastify.log.debug(`Pong received from user: ${userId}`);
        });

        // Gestion de la fermeture
        connection.socket.on('close', () => {
            clearInterval(pingInterval);
            fastify.connections.delete(userId);
            fastify.log.info(`WebSocket connection closed for user: ${userId}`);
        });
    });
}

module.exports = routes;

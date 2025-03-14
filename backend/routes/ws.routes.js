const Redis = require('ioredis');
const redis = new Redis();
const authService = require('../jwt/services/auth.service');

async function routes(fastify, options) {
    // Route pour obtenir le statut en ligne des utilisateurs
    fastify.get('/online-status/:username', async (request, reply) => {
        const { username } = request.params;
        const user = fastify.db.prepare("SELECT id FROM users WHERE username = ?").get(username);
        
        if (!user) return { online: false };
        
        const isOnline = await redis.sismember('online_users', user.id.toString());
        return { online: isOnline };
    });

    // Route WebSocket
    fastify.get('/ws', { websocket: true }, async (connection, req) => {
        try {
            const accessToken = req.cookies?.accessToken;
            if (!accessToken) {
                connection.socket.close();
                return;
            }

            const validation = await authService.validateToken(accessToken, null, 'access');
            if (!validation?.userId) {
                connection.socket.close();
                return;
            }

            const userId = validation.userId;
            const user = fastify.db.prepare("SELECT username FROM users WHERE id = ?").get(userId);

            fastify.log.info(`WebSocket connection established for user: ${user.username}`);
            
            // Ajouter l'utilisateur aux connexions actives
            fastify.connections.set(userId, connection.socket);
            
            // Marquer l'utilisateur comme en ligne dans Redis
            await redis.sadd('online_users', userId.toString());
            
            // Diffuser la mise à jour du statut
            broadcastUserStatus(fastify, userId, true);

            // Configuration du ping-pong et vérification des tokens
            let lastPong = Date.now();
            const pingInterval = setInterval(async () => {
                // Vérifier si les tokens sont toujours valides
                const isTokenValid = await authService.validateToken(accessToken, null, 'access');
                if (!isTokenValid || Date.now() - lastPong > 35000) {
                    clearInterval(pingInterval);
                    connection.socket.close();
                    return;
                }
                if (connection.socket.readyState === 1) {
                    connection.socket.ping();
                }
            }, 30000);

            // Gestion des événements WebSocket
            connection.socket.on('pong', () => {
                lastPong = Date.now();
                fastify.log.debug(`Pong received from user: ${user.username}`);
            });

            connection.socket.on('message', async (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    if (data.type === 'get_online_users') {
                        const onlineUsers = await redis.smembers('online_users');
                        connection.socket.send(JSON.stringify({
                            type: 'online_users',
                            users: onlineUsers
                        }));
                    }
                } catch (error) {
                    fastify.log.error('WebSocket message error:', error);
                }
            });

            // Gestion de la fermeture
            connection.socket.on('close', async () => {
                clearInterval(pingInterval);
                fastify.connections.delete(userId);
                await redis.srem('online_users', userId.toString());
                broadcastUserStatus(fastify, userId, false);
                fastify.log.info(`WebSocket connection closed for user: ${user.username}`);
            });

        } catch (error) {
            fastify.log.error('WebSocket connection error:', error);
            connection.socket.close();
        }
    });
}

// Fonction pour diffuser les changements de statut
async function broadcastUserStatus(fastify, userId, isOnline) {
    const user = fastify.db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
    const message = JSON.stringify({
        type: 'status_update',
        userId: userId,
        username: user.username,
        online: isOnline
    });

    for (const [, socket] of fastify.connections) {
        if (socket.readyState === 1) {
            socket.send(message);
        }
    }
}

module.exports = routes;

const Redis = require('ioredis');
const redis = new Redis();
const authService = require('../jwt/services/auth.service');

async function routes(fastify, options) {
	// Route to get online status of users
    fastify.get('/online-status/:username', async (request, reply) => {
        const { username } = request.params;
        const user = fastify.db.prepare("SELECT id FROM users WHERE username = ?").get(username);
        
        if (!user) return { online: false };
        
        const isOnline = await redis.sismember('online_users', user.id.toString());
        return { online: isOnline };
    });

    // Add new endpoint to check WebSocket status
    fastify.get('/ws/status', async (request, reply) => {
        const userId = request.user.userId;
        const isConnected = fastify.connections.has(userId);
        return { connected: isConnected };
    });

    // Route WebSocket
    fastify.get('/ws', { websocket: true }, async (connection, req) => {
        try {
            const accessToken = req.cookies?.accessToken;
            if (!accessToken) {
                fastify.log.warn('WebSocket connection attempt without access token');
                connection.socket.close(1008, 'No access token provided');
                return;
            }

            const validation = await authService.validateToken(accessToken, null, 'access');
            if (!validation?.userId) {
                fastify.log.warn('WebSocket connection attempt with invalid token');
                connection.socket.close(1008, 'Invalid access token');
                return;
            }

            const userId = validation.userId;
            const user = fastify.db.prepare("SELECT username FROM users WHERE id = ?").get(userId);

            // Handle existing connections
            const existingConnection = fastify.connections.get(userId);
            if (existingConnection) {
                fastify.log.info(`Found existing connection for user ${user.username}`);
                // Close the existing connection if it's still open
                try {
                    if (existingConnection.readyState === 1) {
                        existingConnection.close(1000, 'New connection established');
                    }
                } catch (err) {
                    fastify.log.error(`Error closing existing connection: ${err}`);
                }
                fastify.connections.delete(userId);
            }

            // Establish new connection
            fastify.log.info(`Establishing new WebSocket connection for user: ${user.username}`);
            fastify.connections.set(userId, connection.socket);

			// First check if the user is not already marked as online
            const isAlreadyOnline = await redis.sismember('online_users', userId.toString());
            if (!isAlreadyOnline) {
                await redis.sadd('online_users', userId.toString());
				// Broadcast the status only if there is a change
                broadcastUserStatus(fastify, userId, true);
            }

			// Setting up ping-pong and token validation
            let lastPong = Date.now();
            const pingInterval = setInterval(async () => {
				// Verify if the tokens are still valid
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

			// WebSocket events handling
            connection.socket.on('pong', () => {
                lastPong = Date.now();
                fastify.log.debug(`Pong received from user: ${user.username}`);
            });

			// Messages handling
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

			// Close handling
            connection.socket.on('close', async () => {
                clearInterval(pingInterval);
                fastify.connections.delete(userId);
                await redis.srem('online_users', userId.toString());
                broadcastUserStatus(fastify, userId, false);
                fastify.log.info(`WebSocket connection closed for user: ${user.username}`);
            });

        } catch (error) {
            fastify.log.error('WebSocket connection error:', error);
            if (connection.socket.readyState === WebSocket.OPEN) {
                connection.socket.close(1011, 'Internal server error');
            }
        }
    });
}

// Function to broadcast status changes
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

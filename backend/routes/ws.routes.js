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

    // Route pour les messages du chat
    fastify.post('/live_chat_message', async (request, reply) => {
        const userId = request.user.userId;
        const { message } = request.body;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return reply.code(400).send({ error: 'Invalid message' });
        }

        if (message.trim().length > 1000) {
            return reply.code(400).send({ error: 'Message too long (max 1000 characters)' });
        }

        const user = fastify.db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
        
        // Broadcast le message à tous les clients connectés
        const broadcastMessage = JSON.stringify({
            type: 'livechat',
            user: user.username,
            message: message.trim()
        });

        for (const [, socket] of fastify.connections) {
            if (socket.readyState === 1) { // 1 = WebSocket.OPEN
                socket.send(broadcastMessage);
            }
        }

        return { success: true };
    });

    // Route pour les messages privés
    fastify.post('/direct_chat_message', async (request, reply) => {
        const senderId = request.user.userId;
        const { message, recipient } = request.body;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return reply.code(400).send({ error: 'Invalid message' });
        }

        if (message.trim().length > 1000) {
            return reply.code(400).send({ error: 'Message too long (max 1000 characters)' });
        }

        // Vérifier si le destinataire existe
        const recipientUser = fastify.db.prepare("SELECT id, username FROM users WHERE username = ?").get(recipient);
        if (!recipientUser) {
            return reply.code(404).send({ error: 'Recipient not found' });
        }

        const sender = fastify.db.prepare("SELECT username FROM users WHERE id = ?").get(senderId);

        // Vérifier si le destinataire est en ligne
        const isOnline = await redis.sismember('online_users', recipientUser.id.toString());
        if (!isOnline) {
            return reply.code(400).send({ error: 'User is offline. Cannot send private message.' });
        }

        // Envoyer le message privé
        const privateMessage = JSON.stringify({
            type: 'direct_message',
            user: sender.username,
            recipient: recipientUser.username,
            message: message.trim()
        });

        // Envoyer au destinataire
        const recipientSocket = fastify.connections.get(recipientUser.id);
        if (!recipientSocket || recipientSocket.readyState !== 1) {
            return reply.code(400).send({ error: 'Recipient is not connected' });
        }
        recipientSocket.send(privateMessage);

        // Envoyer une copie à l'expéditeur
        const senderSocket = fastify.connections.get(senderId);
        if (senderSocket && senderSocket.readyState === 1) {
            senderSocket.send(privateMessage);
        }

        return { success: true };
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

            connection.socket.on('message', async (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    if (data.type === 'chat') {
                        // Vous pouvez ajouter ici une validation supplémentaire si nécessaire
                        const user = fastify.db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
                        const broadcastMessage = JSON.stringify({
                            type: 'livechat',
                            user: user.username,
                            message: data.message.trim()
                        });

                        for (const [, socket] of fastify.connections) {
                            if (socket.readyState === 1) {
                                socket.send(broadcastMessage);
                            }
                        }
                    }
                } catch (error) {
                    fastify.log.error('WebSocket message handling error:', error);
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

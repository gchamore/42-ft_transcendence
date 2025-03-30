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
	
		const payload = {
			type: 'livechat',
			user: user.username,
			message: message.trim()
		};
	
		broadcastToAllClients(fastify, payload);
	
		return { success: true };
	});
	

    // Route pour les messages privés
    fastify.post('/direct_chat_message', async (request, reply) => {
		const senderId = request.user.userId;
		const { to, message } = request.body;
	
		if (!message || typeof message !== 'string' || message.trim().length === 0) {
			return reply.code(400).send({ error: 'Invalid message' });
		}
	
		if (!to || typeof to !== 'string') {
			return reply.code(400).send({ error: 'Invalid recipient' });
		}
	
		if (message.trim().length > 1000) {
			return reply.code(400).send({ error: 'Message too long (max 1000 characters)' });
		}
	
		const sender = fastify.db.prepare("SELECT username FROM users WHERE id = ?").get(senderId);
		const recipientUser = fastify.db.prepare("SELECT id FROM users WHERE username = ?").get(to);
	
		if (!recipientUser) {
			return reply.code(404).send({ error: 'Recipient not found' });
		}
	
		const payload = {
			type: 'direct_message',
			user: sender.username,
			message: message.trim()
		};
	
		const delivered = sendPrivateMessage(fastify, recipientUser.id, payload);
	
		if (!delivered) {
			return reply.code(200).send({ warning: 'Recipient is offline. Message not delivered in real-time.' });
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
            
            // Use a unique connection ID for tracking this connection
            const connectionId = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 7);
            fastify.log.info(`New WebSocket connection [ID: ${connectionId}] for user: ${user.username} (${userId})`);

            // Handle existing connections very aggressively
            const existingConnection = fastify.connections.get(userId);
            if (existingConnection) {
                fastify.log.warn(`Found existing connection for user ${user.username} (${userId}), forcing close`);
                try {
                    // Add a close reason to track in logs
                    if (existingConnection.readyState < 2) { // 0 = CONNECTING, 1 = OPEN
                        existingConnection.close(1000, `Replaced by new connection ${connectionId}`);
                    }
                } catch (err) {
                    fastify.log.error(`Error closing existing connection: ${err}`);
                }
                
                // Force remove the connection from the map
                fastify.connections.delete(userId);
                
                // Short delay to ensure cleanup
                await new Promise(resolve => setTimeout(resolve, 150));
            }

            // Establish new connection
            fastify.log.info(`Storing WebSocket connection [ID: ${connectionId}] for user: ${user.username} (${userId})`);
            // Tag this connection with the connection ID for debugging
            connection.socket.connectionId = connectionId;
            fastify.connections.set(userId, connection.socket);

            // Update online status
            if (!await redis.sismember('online_users', userId.toString())) {
				await redis.sadd('online_users', userId.toString());
			}
            broadcastUserStatus(fastify, userId, true);

			// Setting up ping-pong and token validation
            let lastPong = Date.now();
            const pingInterval = setInterval(async () => {
				// Verify if the tokens are still valid
                const isTokenValid = await authService.validateToken(accessToken, null, 'access');
                if (!isTokenValid || Date.now() - lastPong > 35000) {
                    clearInterval(pingInterval);
                    try {
                        if (connection.socket.readyState < 2) {
                            connection.socket.close(1001, "Token invalid or ping timeout");
                        }
                    } catch (err) {
                        fastify.log.error(`Error closing connection on token check: ${err}`);
                    }
                    return;
                }
                
                if (connection.socket.readyState === 1) {
                    connection.socket.ping();
                }
            }, 30000);

			// WebSocket events handling
            connection.socket.on('pong', () => {
                lastPong = Date.now();
                fastify.log.debug(`Pong received from user: ${user.username} [ID: ${connectionId}]`);
            });

			// Close handling with improved cleanup
            connection.socket.on('close', async (code, reason) => {
                clearInterval(pingInterval);
                fastify.log.info(`WebSocket connection [ID: ${connectionId}] closed for user: ${user.username} (${userId}) with code ${code}${reason ? ` and reason: ${reason}` : ''}`);
                
                // Make sure this connection is still the active one before removing
                const currentConnection = fastify.connections.get(userId);
                if (currentConnection === connection.socket) {
                    fastify.log.info(`Removing connection [ID: ${connectionId}] for user: ${user.username}`);
                    fastify.connections.delete(userId);
                    await redis.srem('online_users', userId.toString());
                    broadcastUserStatus(fastify, userId, false);
                } else if (currentConnection) {
                    fastify.log.info(`Connection [ID: ${connectionId}] was replaced by a newer one for user: ${user.username}, skipping cleanup`);
                } else {
                    fastify.log.info(`Connection [ID: ${connectionId}] was already removed for user: ${user.username}`);
                }
            });

        } catch (error) {
            fastify.log.error('WebSocket connection error:', error);
            if (connection.socket.readyState === 1) {
                try {
                    connection.socket.close(1011, 'Internal server error');
                } catch (err) {
                    fastify.log.error(`Error closing connection after error: ${err}`);
                }
            }
        }
    });
}

function sendPrivateMessage(fastify, toUserId, payload) {
	const recipientSocket = fastify.connections.get(toUserId);

	if (recipientSocket && recipientSocket.readyState === 1) {
		recipientSocket.send(JSON.stringify(payload));
		return true;
	}

	return false; // utilisateur non connecté
}


function broadcastToAllClients(fastify, payload) {
	for (const [, socket] of fastify.connections) {
		if (socket.readyState === 1) { // WebSocket.OPEN === 1
			socket.send(JSON.stringify(payload));
		}
	}
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

const Redis = require('ioredis');
const redis = new Redis();
const authService = require('../jwt/services/auth.service');
const wsUtils = require('../ws/ws.utils');

async function routes(fastify, options) {
	// Route for live chat messages
    fastify.post('/live_chat_message', async (request, reply) => {
		const userId = request.user.userId;
		const { message } = request.body;
		
        const result = wsUtils.handleLiveChatMessage(fastify, userId, message);
        
        if (!result.success) {
            return reply.code(400).send({ error: result.error });
        }
	
		return { success: true };
	});
	
	// route for private messages
    fastify.post('/direct_chat_message', async (request, reply) => {
		const senderId = request.user.userId;
		const { to, message } = request.body;
		
        const result = wsUtils.handleDirectMessage(fastify, senderId, to, message);
        
        if (!result.success) {
            return reply.code(400).send({ error: result.error });
        }
        
        if (result.warning) {
            return reply.code(200).send({ warning: result.warning });
        }
	
		return { success: true };
	});

    // Route WebSocket
    fastify.get('/ws', { websocket: true }, async (connection, req) => {
        try {
            const accessToken = req.cookies?.accessToken;
            const validation = await wsUtils.validateWebSocketToken(accessToken);
            
            if (!accessToken) {
                fastify.log.warn('WebSocket connection attempt without access token');
                connection.socket.close(1008, 'No access token provided');
                return;
            }

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
            await wsUtils.updateUserOnlineStatus(userId, true);
            wsUtils.broadcastUserStatus(fastify, userId, true);

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
                    await wsUtils.updateUserOnlineStatus(userId, false);
                    wsUtils.broadcastUserStatus(fastify, userId, false);
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

module.exports = routes;

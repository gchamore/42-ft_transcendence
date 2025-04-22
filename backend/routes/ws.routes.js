import * as wsUtils from '../ws/ws.utils.js';
import wsService from '../ws/ws.service.js';

export async function wsRoutes(fastify, options) {
	/*** 📌 Route: live chat messages ***/
	// Route to handle live chat messages
	// It receives a message from the user and broadcasts it to all connected users
	// It returns a success message if the message is sent successfully
	// It requires the user to be authenticated
	// It uses the WebSocket connection to send the message
    fastify.post('/live_chat_message', async (request, reply) => {
		const userId = request.user.userId;
		const { message } = request.body;
		
        const result = await wsUtils.handleLiveChatMessage(fastify, userId, message);
        
        if (!result.success) {
            return reply.code(400).send({ error: result.error });
        }

        return { success: true };
	});

	/*** 📌 Route: private messages ***/
	// Route to handle private messages
	// It receives a message from the user and sends it to a specific user
	// It returns a success message if the message is sent successfully
	// It requires the user to be authenticated
	// It uses the WebSocket connection to send the message
	// It also checks if the recipient is online and sends a warning if not
    fastify.post('/direct_chat_message', async (request, reply) => {
		const senderId = request.user.userId;
		const { to, message } = request.body;
		
        const result = await wsUtils.handleDirectMessage(fastify, senderId, to, message);
        
        if (!result.success) {
            return reply.code(400).send({ error: result.error });
        }
        
        if (result.warning) {
            return reply.code(200).send({ warning: result.warning });
        }
	
		return { success: true };
	});

    /*** 📌 Route: WebSocket ***/
	// Route to establish a WebSocket connection
	// It validates the access token and sets up the connection
	// It handles the connection events and messages
	// It requires the user to be authenticated
	// It uses the WebSocket connection to send and receive messages
	// It also handles reconnections and disconnections
	// It returns a success message if the connection is established successfully
	// It uses the ws library to handle WebSocket connections
    fastify.get('/ws', { websocket: true }, async (connection, req) => {
        try {
			// Validate the access token
			const accessToken = req.cookies?.accessToken;
			console.log('Token reçu:', accessToken);
			const validation = await wsService.validateConnectionToken(fastify, connection, accessToken);
			if (!validation) {
				console.warn('Access token invalide ERROR');
				return;
			}

			console.log('3');
			const userId = validation.userId;
			const user = fastify.db.prepare("SELECT username FROM users WHERE id = ?").get(userId);

			// Generate a unique ID for the connection
			const connectionId = wsService.generateConnectionId();
            fastify.log.info(`New WebSocket connection [ID: ${connectionId}] for user: ${user.username} (${userId})`);
            
			// Handle existing connections
            await wsService.handleExistingConnections(fastify, userId, user.username, connectionId);
            
			// Establish the new connection
            await wsService.establishConnection(fastify, connection, userId, user.username, connectionId);
            
			// Set up WebSocket events
            wsService.setupWebSocketEvents(fastify, connection, accessToken, userId, user.username, connectionId);
            
			} catch (error) {
				console.error('🔥 WebSocket /ws error caught:', error?.message || error);
				wsService.handleConnectionError(fastify, connection, error);
			}
			
    });
}

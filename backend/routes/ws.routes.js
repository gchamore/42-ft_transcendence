import * as wsUtils from '../ws/ws.utils.js';
import wsService from '../ws/ws.service.js';

export async function wsRoutes(fastify, options) {
	// Route for live chat messages
    fastify.post('/live_chat_message', async (request, reply) => {
		const userId = request.user.userId;
		const { message } = request.body;
		
        const result = await wsUtils.handleLiveChatMessage(fastify, userId, message);
        
        if (!result.success) {
            return reply.code(400).send({ error: result.error });
        }

        return { success: true };
	});
	
	// route for private messages
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

    // Route WebSocket - Conservation de la logique principale
    fastify.get('/ws', { websocket: true }, async (connection, req) => {
        try {
            // Validation du token
            const accessToken = req.cookies?.accessToken;
            const validation = await wsService.validateConnectionToken(fastify, connection, accessToken);
            if (!validation) return;

            const userId = validation.userId;
            const user = fastify.db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
            
            // Générer un ID unique pour la connexion
            const connectionId = wsService.generateConnectionId();
            fastify.log.info(`New WebSocket connection [ID: ${connectionId}] for user: ${user.username} (${userId})`);
            
            // Gérer les connexions existantes
            await wsService.handleExistingConnections(fastify, userId, user.username, connectionId);
            
            // Établir la nouvelle connexion
            await wsService.establishConnection(fastify, connection, userId, user.username, connectionId);
            
            // Configurer les événements WebSocket
            wsService.setupWebSocketEvents(fastify, connection, accessToken, userId, user.username, connectionId);
            
        } catch (error) {
            wsService.handleConnectionError(fastify, connection, error);
        }
    });
}

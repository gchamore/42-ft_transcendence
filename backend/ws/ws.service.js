import authService from '../auth/auth.service.js';
import * as wsUtils from './ws.utils.js';

export class WebSocketService {
	// Validate the WebSocket connection
	// It checks if the access token is valid and if the user is authenticated
	async validateConnectionToken(fastify, connection, accessToken, refreshToken) {
		if (!accessToken && !refreshToken) {
			fastify.log.warn('WebSocket connection attempt without access and refresh token');
			connection.socket.close(1008, 'No tokens provided');
			return null;
		}

		const validation = await wsUtils.validateWebSocketToken(fastify, accessToken, refreshToken);
		if (!validation?.userId) {
			fastify.log.warn('WebSocket connection attempt with invalid token');
			connection.socket.close(1008, 'Invalid access token');
			return null;
		}

		return validation;
	}

	// Establish the WebSocket connection
	generateConnectionId() {
		return Date.now().toString() + '-' + Math.random().toString(36).substring(2, 7);
	}

	// Establish the WebSocket connection
	// It stores the connection in the map and updates the online status
	// It sends the list of online users to the client
	// It broadcasts the online status to other clients
	async establishConnection(fastify, connection, userId, username, connectionId) {
		fastify.log.info(`Storing WebSocket connection [ID: ${connectionId}] for user: ${username} (${userId})`);
	
		// Marquer l'ID sur la socket pour debug/fermeture
		connection.socket.connectionId = connectionId;
	
		// Crée une map par utilisateur s’il n’en a pas déjà une
		if (!fastify.connections.has(userId)) {
			fastify.connections.set(userId, new Map());
		}
	
		// Ajoute cette connexion dans la sous-Map du user
		const userConnections = fastify.connections.get(userId);
		userConnections.set(connectionId, connection.socket);
	
		// Update des status utilisateurs
		await wsUtils.updateUserOnlineStatus(userId, true);
		await wsUtils.sendOnlineUsersList(fastify, userId);
		wsUtils.broadcastUserStatus(fastify, userId, true);
	}

	// Set up the WebSocket events
	// It handles the ping-pong mechanism and the connection close event
	// It requires the user to be authenticated
	// It validates the access token and handles the connection events
	setupWebSocketEvents(fastify, connection, accessToken, refreshToken, userId, username, connectionId) {
		// Configuration of the ping-pong and token validation
		let lastPong = Date.now();
		const pingInterval = setInterval(async () => {
			// Check if the tokens are still valid
			const result = await authService.validateToken(fastify, accessToken, refreshToken, 'access');
			// if the token is invalid or the pong timeout is reached
			if (!result || Date.now() - lastPong > 35000) {
				await this.wsUtils.handleAllUserConnectionsClose(fastify, userId, username, 'Token invalid or ping timeout');
				return;
			}
			if (result.newAccessToken) {
				if (connection.socket.readyState === 1) {
					connection.socket.send(JSON.stringify({
						type: 'refresh_request',
						message: 'Please refresh your token via /refresh',
					}));
				}
			}
			// If the connection is still open, send a ping
			if (connection.socket.readyState === 1) {
				connection.socket.ping();
			}
		}, 30000);
	
		// WebSocket event handling for pong response
		connection.socket.on('pong', () => {
			lastPong = Date.now();
			fastify.log.debug(`Pong received from user: ${username} [ID: ${connectionId}]`);
		});

		// Log all active WebSocket connections for all users
		fastify.log.info('📡 Active WebSocket connections per user:');
		for (const [uid, connectionsMap] of fastify.connections.entries()) {
			const connectionIds = Array.from(connectionsMap.keys());
			fastify.log.info(`- User ${uid}: ${connectionIds.length} connection(s) [IDs: ${connectionIds.join(', ')}]`);
		}

		// Connection close handling
		connection.socket.on('close', async (code, reason) => {
			fastify.log.warn(`❌ WebSocket closed for user ${userId} [connID: ${connectionId}] with code ${code} and reason "${reason}"`);
			clearInterval(pingInterval);
		});
	}
}

export default new WebSocketService();

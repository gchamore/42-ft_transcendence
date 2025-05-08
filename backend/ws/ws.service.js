import * as wsUtils from './ws.utils.js';

export class WebSocketService {

	// Establish the WebSocket connection
	generateConnectionId() {
		return Date.now().toString() + '-' + Math.random().toString(36).substring(2, 7);
	}

	// Establish the WebSocket connection
	// It stores the connection in the map and updates the online status
	// It sends the list of online users to the client
	// It broadcasts the online status to other clients
	async establishConnection(fastify, connection, userId, connectionId) {
		// Marquer l'ID sur la socket pour debug/fermeture
		connection.socket.connectionId = connectionId;

		// Crée une map par utilisateur s’il n’en a pas déjà une
		if (!fastify.connections.has(userId)) {
			fastify.connections.set(userId, new Map());
		}
	
		// Ajoute cette connexion dans la sous-Map du user
		const userConnections = fastify.connections.get(userId);
		userConnections.set(connectionId, connection.socket);
		connection.socket.isDisconnecting = false;

	
		// Update des status utilisateurs
		await wsUtils.updateUserOnlineStatus(userId, true);
		await wsUtils.sendOnlineUsersList(fastify, userId);
		wsUtils.broadcastUserStatus(fastify, userId, true);
	}

	// Set up the WebSocket events
	// It handles the ping-pong mechanism and the connection close event
	// It requires the user to be authenticated
	// It validates the access token and handles the connection events
	setupWebSocketEvents(fastify, connection, userId, username, connectionId) {
		// Configuration of the ping-pong and token validation
		let lastPong = Date.now();
		const pingInterval = setInterval(async () => {
			// if the token is invalid or the pong timeout is reached
			if (Date.now() - lastPong > 35000) {
				await this.wsUtils.handleAllUserConnectionsClose(fastify, String(userId), username, 'Token invalid or ping timeout');
				return;
			}
			fastify.log.info('========== 🔄 WebSocket Connection Check ==========');
			fastify.log.info(`👤 User ID: ${userId}, Username: ${username}`);
			const userConnections = fastify.connections.get(userId);
			if (userConnections) {
				const connectionIds = Array.from(userConnections.keys());
				fastify.log.info(`🔗 ${connectionIds.length} active connection(s): [${connectionIds.join(', ')}]`);
			} else {
				fastify.log.info('❌ No active connections.');
			}
			fastify.log.info('==================================================\n');

			// If the connection is still open, send a ping
			if (connection.socket.readyState === 1) {
				connection.socket.ping();
			}
		}, 30000);

		// WebSocket event handling for pong response
		connection.socket.on('pong', () => {
			lastPong = Date.now();
		});

		// Connection close handling
		connection.socket.on('close', async (code, reason) => {
			try {
				if (connection.socket.isDisconnecting) {
					fastify.log.info(`🛑 Socket closed intentionally for user ${username} [connID: ${connectionId}]`);
					clearInterval(pingInterval);
					return;
				}
		
				connection.socket.isDisconnecting = true;

				fastify.log.warn(`❌ Unexpected WebSocket close for user ${username} [connID: ${connectionId}] - Code: ${code} Reason: "${reason}"`);
		
				clearInterval(pingInterval);
		
				await wsUtils.handleSingleUserConnectionClose( fastify, connection, code, (reason || 'Unexpected disconnect'), userId, username, connectionId);
		
			} catch (err) {
				fastify.log.error(err, `Error handling WebSocket close for user ${username}`);
			}
		});
		
	}
}

export default new WebSocketService();

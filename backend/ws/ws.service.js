import authService from '../auth/auth.service.js';
import * as wsUtils from './ws.utils.js';

export class WebSocketService {
	// Validate the WebSocket connection
	// It checks if the access token is valid and if the user is authenticated
	async validateConnectionToken(fastify, connection, accessToken) {
		if (!accessToken) {
			fastify.log.warn('WebSocket connection attempt without access token');
			connection.socket.close(1008, 'No access token provided');
			return null;
		}

		const validation = await wsUtils.validateWebSocketToken(accessToken);
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

	// Handle the WebSocket connection
	// It sets up the connection and handles the events
	// It requires the user to be authenticated
	async handleExistingConnections(fastify, userId, username, connectionId) {
		const existingConnection = fastify.connections.get(userId);
		// Check if the user already has an active connection
		if (existingConnection) {
			fastify.log.warn(`Found existing connection for user ${username} (${userId}), forcing close`);
			try {
				if (existingConnection.readyState < 2) {
					existingConnection.close(1000, `Replaced by new connection ${connectionId}`);
				}
			} catch (err) {
				fastify.log.error(`Error closing existing connection: ${err}`);
			}

			fastify.connections.delete(userId);

			// Delay to ensure the cleanup
			await new Promise(resolve => setTimeout(resolve, 150));
		}
	}

	// Establish the WebSocket connection
	// It stores the connection in the map and updates the online status
	// It sends the list of online users to the client
	// It broadcasts the online status to other clients
	async establishConnection(fastify, connection, userId, username, connectionId) {
		fastify.log.info(`Storing WebSocket connection [ID: ${connectionId}] for user: ${username} (${userId})`);

		// Mark this connection with the ID for debugging
		connection.socket.connectionId = connectionId;
		fastify.connections.set(userId, connection.socket);

		// Update the online status and send the list of online users
		await wsUtils.updateUserOnlineStatus(userId, true);
		await wsUtils.sendOnlineUsersList(fastify, userId);
		wsUtils.broadcastUserStatus(fastify, userId, true);
	}

	// Set up the WebSocket events
	// It handles the ping-pong mechanism and the connection close event
	// It requires the user to be authenticated
	// It validates the access token and handles the connection events
	setupWebSocketEvents(fastify, connection, accessToken, userId, username, connectionId) {
		// Configuration of the ping-pong and token validation
		let lastPong = Date.now();
		const pingInterval = setInterval(async () => {
			// Check if the tokens are still valid
			const isTokenValid = await authService.validateToken(accessToken, null, 'access');
			// if the token is invalid or the pong timeout is reached
			if (!isTokenValid || Date.now() - lastPong > 35000) {
				this.handleInvalidToken(fastify, connection, connectionId, pingInterval);
				return;
			}
			// If the connection is still open, send a ping
			if (connection.socket.readyState === 1) {
				connection.socket.ping();
			}
		}, 30000);

		// WebSocket event handling
		connection.socket.on('pong', () => {
			lastPong = Date.now();
			fastify.log.debug(`Pong received from user: ${username} [ID: ${connectionId}]`);
		});

		// Connection close handling
		connection.socket.on('close', async (code, reason) => {
			this.handleConnectionClose(fastify, connection, pingInterval, code, reason, userId, username, connectionId);
		});
	}

	// Handle invalid token
	// It closes the connection and clears the ping interval
	// It requires the user to be authenticated
	// It handles the connection close event
	handleInvalidToken(fastify, connection, connectionId, pingInterval) {
		// Log the invalid token and close the connection
		clearInterval(pingInterval);
		try {
			if (connection.socket.readyState < 2) {
				connection.socket.close(1001, "Token invalid or ping timeout");
			}
		} catch (err) {
			fastify.log.error(`Error closing connection on token check: ${err}`);
		}
	}

	// Handle the connection close event
	// It clears the ping interval and removes the connection from the map
	// It updates the online status and broadcasts the offline status to other clients
	// It requires the user to be authenticated
	// It handles the connection close event
	async handleConnectionClose(fastify, connection, pingInterval, code, reason, userId, username, connectionId) {
		// Log the connection close event
		clearInterval(pingInterval);
		fastify.log.info(`WebSocket connection [ID: ${connectionId}] closed for user: ${username} (${userId}) with code ${code}${reason ? ` and reason: ${reason}` : ''}`);

		// Ensure this connection is still active before removing it
		const currentConnection = fastify.connections.get(userId);
		if (currentConnection === connection.socket) {
			fastify.log.info(`Removing connection [ID: ${connectionId}] for user: ${username}`);
			fastify.connections.delete(userId);
			await wsUtils.updateUserOnlineStatus(userId, false);
			wsUtils.broadcastUserStatus(fastify, userId, false);
		} else if (currentConnection) {
			fastify.log.info(`Connection [ID: ${connectionId}] was replaced by a newer one for user: ${username}, skipping cleanup`);
		} else {
			fastify.log.info(`Connection [ID: ${connectionId}] was already removed for user: ${username}`);
		}
	}

	// Handle connection error
	// It logs the error and closes the connection if it's still open
	// It requires the user to be authenticated
	// It handles the connection error event
	handleConnectionError(fastify, connection, error) {
		fastify.log.error('WebSocket connection error:', error);
		if (connection.socket.readyState === 1) {
			try {
				connection.socket.close(1011, 'Internal server error');
			} catch (err) {
				fastify.log.error(`Error closing connection after error: ${err}`);
			}
		}
	}
}

export default new WebSocketService();

import redis from '../redis/redisClient.js';


// This function checks if a user has blocked another user
// It takes the fastify instance, blockerId, and blockedId as parameters
// It queries the database to check if the blocker has blocked the blocked user
export function hasUserBlocked(fastify, blockerId, blockedId) {
	const result = fastify.db.prepare(`
		SELECT 1 FROM blocks
		WHERE blocker_id = ? AND blocked_id = ?
	`).get(blockerId, blockedId);

	return !!result;
}


// Handle the connection close event
// It clears the ping interval and removes the connection from the map
// It updates the online status and broadcasts the offline status to other clients
// It requires the user to be authenticated
// It handles the connection close event
export async function handleSingleUserConnectionClose(fastify, connection, code, reason, userId, username, connectionId) {

	const userConnections = fastify.connections.get(userId);
	if (!userConnections) {
		fastify.log.info(`No active connections found for user: ${username}`);
		return;
	}

	const existingConnection = userConnections.get(connectionId);
	if (existingConnection === connection.socket) {
		fastify.log.info(`Removing Single connection [ID: ${connectionId}] for user: ${username}`);
		userConnections.delete(connectionId);

		if (userConnections.size === 0) {
			fastify.connections.delete(userId);
			await updateUserOnlineStatus(userId, false); // Redis
			await broadcastUserStatus(fastify, userId, false);
		}
	} else {
		fastify.log.info(`Connection [ID: ${connectionId}] already replaced or removed for user: ${username}`);
	}
}


export async function handleAllUserConnectionsClose(fastify, userId, username, reason = 'Disconnected by server') {
	fastify.log.info(`🚪 Closing ALL WebSocket connections for user ${username} (${userId}) with reason: "${reason}"`);

	const userConnections = fastify.connections.get(userId);
	if (!userConnections) {
		fastify.log.info(`No active WebSocket connections to close for user: ${username}`);
		return;
	}

	for (const [connectionId, socket] of userConnections.entries()) {
		if (socket.readyState < 2) {
			try {
				socket.isDisconnecting = true;
				socket.close(1000, reason);
				fastify.log.info(`Closed WebSocket connection [ID: ${connectionId}] for user: ${username}`);
			} catch (error) {
				fastify.log.error(`Error closing connection [ID: ${connectionId}] for user ${username}:`, error);
			}
		}
	}

	fastify.connections.delete(userId);
	await updateUserOnlineStatus(userId, false);
	await broadcastUserStatus(fastify, userId, false);
}


export async function handleAllConnectionsCloseForAllUsers(fastify, reason = 'Disconnected by server') {
	fastify.log.info(`🚪 Closing ALL WebSocket connections with reason: "${reason}"`);

	for (const [userId, userConnections] of fastify.connections.entries()) {
		for (const [connectionId, socket] of userConnections.entries()) {
			if (socket.readyState < 2) {
				try {
					socket.isDisconnecting = true;
					socket.close(1000, reason);
					fastify.log.info(`Closed connection [ID: ${connectionId}] for user: ${userId}`);
				} catch (error) {
					fastify.log.error(`Error closing connection [ID: ${connectionId}] for user: ${userId}: ${error}`);
				}
			}
		}
	}

	// Nettoyage global de fastify.connections
	fastify.connections.clear();

	// Nettoyage Redis
	try {
		await redis.del('online_users');
		fastify.log.info('✅ Cleared online_users from Redis');
	} catch (err) {
		fastify.log.error('❌ Failed to clear Redis online_users:', err);
	}
}



export async function handleConnectionError(fastify, connection, error, userId, connectionId, username) {
	fastify.log.error(`WebSocket connection error [ID: ${connectionId}] for user: ${username} (${userId}):`, error);

	if (connection.socket.readyState === 1) {
		try {
			connection.socket.close(1011, 'Internal server error');
		} catch (error) {
			fastify.log.error(`Error closing connection [ID: ${connectionId}]:`, error);
		}
	}

	// Nettoyage dans la map
	const userConnections = fastify.connections.get(userId);
	if (userConnections && userConnections.get(connectionId) === connection.socket) {
		userConnections.delete(connectionId);
		fastify.log.info(`Removed faulty connection [ID: ${connectionId}] for user: ${username}`);

		// Si c'était la dernière connexion
		if (userConnections.size === 0) {
			fastify.connections.delete(userId);
			await updateUserOnlineStatus(userId, false);
			broadcastUserStatus(fastify, userId, false);
		}
	}
}


// This function broadcasts a message to all connected clients
// It takes the fastify instance and the payload
// It converts the payload to a string if it's not already
// It sends the message to each connected socket
// It returns the number of sent messages
export function broadcastToAllClients(fastify, payload) {
	const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
	let sentCount = 0;

	for (const [userId, connectionsMap] of fastify.connections.entries()) {
		for (const [, socket] of connectionsMap.entries()) {
			if (socket.readyState === 1) {
				socket.send(message);
				sentCount++;
				break;
			}
		}
	}

	// fastify.log.info(`Broadcasted to ${sentCount} first sockets (1 per user).`);
	return sentCount;
}


// This function broadcasts a message to all connected clients except the sender
// It takes the fastify instance, payload, and the userId of the sender
// It converts the payload to a string if it's not already
// It sends the message to each connected socket except the sender's
export function broadcastToAllExceptSender(fastify, payload, excludeUserId) {
	const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
	let sentCount = 0;

	for (const [userId, connectionsMap] of fastify.connections.entries()) {
		if (userId.toString() === excludeUserId.toString()) continue;

		// Vérifie si l'utilisateur a bloqué l'expéditeur
		const blocked = hasUserBlocked(fastify, userId, excludeUserId);
		if (blocked) continue;

		for (const [, socket] of connectionsMap.entries()) {
			if (socket.readyState === 1) {
				socket.send(message);
				sentCount++;
				break;
			}
		}
	}

	return sentCount;
}


// This function sends a message to a specific user
// It takes the fastify instance, userId, and payload
// It converts the payload to a string if it's not alreadywsService.
// It checks if the socket is open before sending the message
// It returns true if the message was sent, false otherwise
export function sendToUser(fastify, userId, payload) {
	const userConnections = fastify.connections.get(userId);
	if (!userConnections) return false;

	for (const [, socket] of userConnections.entries()) {
		if (socket.readyState === 1) {
			const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
			socket.send(message);
			return true;
		}
	}

	return false;
}



// This function broadcasts the user's online status to all clients
// It takes the fastify instance, userId, and online status
// It retrieves the user's username from the database
// It creates a payload with the user's status and broadcasts it
// It returns true if the user was found and the message was sent, false otherwise
export async function broadcastUserStatus(fastify, userId, isOnline) {
	const user = fastify.db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
	if (!user) return false;

	const payload = {
		type: 'status_update',
		userId: userId,
		username: user.username,
		online: isOnline
	};

	return broadcastToAllClients(fastify, payload);
}

// This function updates the user's online status in Redis
// It takes the userId and online status as parameters
// It adds or removes the user from the online_users set in Redis
// It returns true if the status was updated, false otherwise
// It checks if the user is already in the set before adding
// It removes the user from the set if they are offline
export async function updateUserOnlineStatus(userId, isOnline) {
	if (isOnline) {
		if (!await redis.sismember('online_users', userId.toString())) {
			await redis.sadd('online_users', userId.toString());
			return true;
		}
	} else {
		await redis.srem('online_users', userId.toString());
		return true;
	}
	return false;
}

// It returns false if the user was already in the set
// It returns true if the user was added to the set
export async function isUserOnline(userId) {
	return await redis.sismember('online_users', userId.toString());
}

// This function handles live chat messages
// It takes the fastify instance, userId, and message as parameters
// It checks if the user is connected and if the message is valid
// It retrieves the user's username from the database
// It creates a payload with the message and broadcasts it to all clients
export async function handleLiveChatMessage(fastify, userId, message) {
	// Vérifier d'abord si l'utilisateur est bien connecté
	const isConnected = fastify.connections.has(userId);
	if (!isConnected) {
		return { success: false, error: 'You must be connected to send messages' };
	}

	if (!message || typeof message !== 'string' || message.trim().length === 0) {
		return { success: false, error: 'Invalid message' };
	}

	if (message.trim().length > 100) {
		return { success: false, error: 'Message too long (max 100 characters)' };
	}
	
	// Security checks for code injection and script attacks
	const sanitizedMessage = sanitizeMessage(message.trim());
	
	// Check for potential XSS attacks
	if (containsXSS(sanitizedMessage)) {
		return { success: false, error: 'Message contains potentially harmful content' };
	}
	
	// Check for SQL injection attempts
	if (containsSQLInjection(sanitizedMessage)) {
		return { success: false, error: 'Message contains invalid syntax' };
	}

	const user = fastify.db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
	if (!user) {
		return { success: false, error: 'User not found' };
	}

	const payload = {
		type: 'livechat',
		user: user.username,
		message: sanitizedMessage
	};

	broadcastToAllExceptSender(fastify, payload, userId);

	return { success: true };
}

// This function handles direct messages
// It takes the fastify instance, senderId, recipientUsername, and message as parameters
// It checks if the sender is connected and if the message is valid
// It retrieves the sender's username and checks if the recipient exists
// It checks if the sender is blocked by the recipient
// It checks if the recipient is connected
// It creates a payload with the message and sends it to the recipient
// It returns true if the message was sent, false otherwise
export async function handleDirectMessage(fastify, senderId, recipientUsername, message) {
	// Verify if the sender is connected
	const isSenderConnected = fastify.connections.has(senderId);
	if (!isSenderConnected) {
		return { success: false, error: 'You must be connected to send messages' };
	}

	if (!message || typeof message !== 'string' || message.trim().length === 0) {
		return { success: false, error: 'Invalid message' };
	}

	if (!recipientUsername || typeof recipientUsername !== 'string') {
		return { success: false, error: 'Invalid recipient' };
	}

	if (message.trim().length > 100) {
		return { success: false, error: 'Message too long (max 100 characters)' };
	}
	
	// Security checks for code injection and script attacks
	const sanitizedMessage = sanitizeMessage(message.trim());
	
	// Check for potential XSS attacks
	if (containsXSS(sanitizedMessage)) {
		return { success: false, error: 'Message contains potentially harmful content' };
	}
	
	// Check for SQL injection attempts
	if (containsSQLInjection(sanitizedMessage)) {
		return { success: false, error: 'Message contains invalid syntax' };
	}

	const sender = fastify.db.prepare("SELECT username FROM users WHERE id = ?").get(senderId);
	if (!sender) {
		return { success: false, error: 'Sender not found' };
	}

	// Check if sending to self
	if (recipientUsername === sender.username) {
		return { success: false, error: 'Cannot send messages to yourself' };
	}

	const recipientUser = fastify.db.prepare("SELECT id FROM users WHERE username = ?").get(recipientUsername);
	if (!recipientUser) {
		return { success: false, error: 'Recipient not found' };
	}
	recipientUser.id = recipientUser.id.toString();
	// Verify if the sender is blocked by the recipient
	const isBlocked = fastify.db.prepare(`
        SELECT 1 FROM blocks 
        WHERE (blocker_id = ? AND blocked_id = ?) 
           OR (blocker_id = ? AND blocked_id = ?)
    `).get(recipientUser.id, senderId, senderId, recipientUser.id);

	if (isBlocked) {
		return { success: false, error: 'Cannot send message due to block status' };
	}

	// Verify if the recipient is connected
	const isRecipientConnected = fastify.connections.has(recipientUser.id);
	if (!isRecipientConnected) {
		return { success: false, error: 'Recipient is offline. Cannot send message to offline users.' };
	}

	const payload = {
		type: 'direct_message',
		user: sender.username,
		recipient: recipientUsername,
		message: sanitizedMessage
	};

	const delivered = sendToUser(fastify, recipientUser.id, payload);

	if (!delivered) {
		return { success: false, error: 'Failed to deliver message. Recipient may have disconnected.' };
	}

	let chat = fastify.db.prepare(`
		SELECT id FROM chats
		WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
	`).get(senderId, recipientUser.id, recipientUser.id, senderId);

	if (!chat) {
		const insertChat = fastify.db.prepare(`
		INSERT INTO chats (user1_id, user2_id) VALUES (?, ?)
	`);
		const result = insertChat.run(senderId, recipientUser.id);
		chat = { id: result.lastInsertRowid };
	}

	fastify.db.prepare(`
		INSERT INTO chat_messages (chat_id, sender_id, content)
		VALUES (?, ?, ?)
	`).run(chat.id, senderId, sanitizedMessage);

	return { success: true };
}

// Helper function to sanitize message content
function sanitizeMessage(message) {
	// Replace HTML special characters to prevent HTML injection
	return message
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

// Check for potential XSS patterns
function containsXSS(message) {
	const xssPatterns = [
		/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i, // <script> tags
		/javascript\s*:/i,                                    // javascript: protocol
		/on\w+\s*=/i,                                        // event handlers like onclick=
		/src\s*=/i,                                          // src attributes
		/data\s*:/i                                          // data: protocol
	];
	
	return xssPatterns.some(pattern => pattern.test(message));
}

// Check for SQL injection attempts
function containsSQLInjection(message) {
	const sqlPatterns = [
		/(\b(select|insert|update|delete|drop|alter|create|exec)\b)/i, // SQL keywords
		/(\b(union|join)\b.*\b(select)\b)/i,                         // UNION or JOIN with SELECT
		/--/,                                                        // SQL comment
		/;.*$/                                                       // Multiple statements
	];
	
	return sqlPatterns.some(pattern => pattern.test(message));
}

// This function retrieves the list of online users
// It takes the fastify instance as a parameter
// It retrieves the online user IDs from Redis
// It creates a map of usernames and returns it
// It returns an empty array if no online users are found
// It returns an object with usernames as keys and true as values
export async function getOnlineUsers(fastify) {
	const onlineUserIds = await redis.smembers('online_users');
	if (onlineUserIds.length === 0) return [];

	const onlineUsersMap = {};
	onlineUserIds.forEach(id => {
		const user = fastify.db.prepare("SELECT username FROM users WHERE id = ?").get(id);
		if (user) onlineUsersMap[user.username] = true;
	});

	return onlineUsersMap;
}

// This function sends the list of online users to a specific user
// It takes the fastify instance and userId as parameters
// It retrieves the online users from Redis
// It creates a payload with the list of online users
// It sends the payload to the user
// It returns true if the message was sent, false otherwise
export async function sendOnlineUsersList(fastify, userId) {
	const onlineUsers = await getOnlineUsers(fastify);
	const payload = {
		type: 'onlines',
		users: onlineUsers
	};

	sendToUser(fastify, userId, payload);
}
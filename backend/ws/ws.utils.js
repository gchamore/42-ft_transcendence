import redis from '../redis/redisClient.js';
import authService from '../jwt/services/auth.service.js';

/**
 * Close a WebSocket connection for a specific user
 * @param {Object} fastify - Fastify instance
 * @param {number|string} userId - User ID
 * @param {number} code - WebSocket close code (default: 1000)
 * @param {string} reason - Reason for closing (default: "Connection closed")
 * @param {boolean} updateStatus - Whether to update user online status (default: false)
 * @returns {boolean} - True if connection was closed, false if no connection found
 */
export async function closeUserWebSocket(fastify, userId, code = 1000, reason = "Connection closed", updateStatus = false) {
    const wsConnection = fastify.connections.get(userId);
    if (wsConnection) {
        fastify.log.info(`Closing WebSocket connection for user: ${userId} with reason: ${reason}`);
        try {
            // Only close if connection is open or connecting
            if (wsConnection.readyState < 2) { // 0 = CONNECTING, 1 = OPEN
                wsConnection.close(code, reason);
            }
            fastify.connections.delete(userId);
            
            // Update Redis and broadcast status only if requested
            // (This allows the logout route to broadcast status first)
            if (updateStatus) {
                await redis.srem('online_users', userId.toString());
                fastify.log.info(`Removed user ${userId} from online_users in Redis`);
                broadcastUserStatus(fastify, userId, false);
            }
            
            return true;
        } catch (error) {
            fastify.log.error(`Error closing WebSocket connection: ${error.message}`);
            return false;
        }
    }
    return false;
}

/**
 * Close all WebSocket connections
 * @param {Object} fastify - Fastify instance
 * @param {number} code - WebSocket close code (default: 1000)
 * @param {string} reason - Reason for closing (default: "Server shutdown")
 */
export async function closeAllWebSockets(fastify, code = 1000, reason = "Server shutdown") {
    fastify.log.info(`Closing all WebSocket connections with reason: ${reason}`);
    
    const closedConnections = [];
    let errorCount = 0;
    
    // Close all connections
    for (const [userId, ws] of fastify.connections) {
        try {
            if (ws.readyState < 2) { // Only if CONNECTING or OPEN
                ws.close(code, reason);
                closedConnections.push(userId);
            }
        } catch (error) {
            fastify.log.error(`Error closing WebSocket for user ${userId}: ${error.message}`);
            errorCount++;
        }
    }
    
    // Clear the connections map
    fastify.connections.clear();
    
    // Clear Redis online users set
    const onlineUsers = await redis.smembers('online_users');
    if (onlineUsers.length > 0) {
        await redis.del('online_users');
    }
    
    fastify.log.info(`Closed ${closedConnections.length} WebSocket connections with ${errorCount} errors`);
    return closedConnections.length;
}

/**
 * Broadcast a message to all connected WebSocket clients
 * @param {Object} fastify - Fastify instance
 * @param {Object} payload - Message payload to broadcast
 */
export function broadcastToAllClients(fastify, payload) {
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
    let sentCount = 0;
    
    for (const [, socket] of fastify.connections) {
        if (socket.readyState === 1) { // WebSocket.OPEN === 1
            socket.send(message);
            sentCount++;
        }
    }
    
    return sentCount;
}

/**
 * Broadcast a message to all connected WebSocket clients except the sender
 * @param {Object} fastify - Fastify instance
 * @param {Object} payload - Message payload to broadcast
 * @param {number|string} excludeUserId - User ID to exclude from broadcast
 */
export function broadcastToAllExceptSender(fastify, payload, excludeUserId) {
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
    let sentCount = 0;
    
    for (const [userId, socket] of fastify.connections) {
        if (userId.toString() !== excludeUserId.toString() && socket.readyState === 1) {
            socket.send(message);
            sentCount++;
        }
    }
    
    return sentCount;
}

/**
 * Send a message to a specific user
 * @param {Object} fastify - Fastify instance
 * @param {number|string} userId - User ID to send message to
 * @param {Object} payload - Message payload
 * @returns {boolean} - True if message was sent, false if user not connected
 */
export function sendToUser(fastify, userId, payload) {
    const socket = fastify.connections.get(userId);
    
    if (socket && socket.readyState === 1) {
        const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
        socket.send(message);
        return true;
    }
    
    return false;
}

/**
 * Broadcast user status change to all connected clients
 * @param {Object} fastify - Fastify instance
 * @param {number|string} userId - User ID whose status changed
 * @param {boolean} isOnline - Whether the user is now online
 */
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

/**
 * Update user's online status in Redis
 * @param {number|string} userId - User ID
 * @param {boolean} isOnline - Whether the user is online
 */
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

/**
 * Check if a user is online
 * @param {number|string} userId - User ID to check
 * @returns {Promise<boolean>} - True if user is online
 */
export async function isUserOnline(userId) {
    return await redis.sismember('online_users', userId.toString());
}

/**
 * Validate WebSocket connection token
 * @param {string} accessToken - JWT access token
 * @returns {Promise<Object|null>} - User validation object or null if invalid
 */
export async function validateWebSocketToken(accessToken) {
    if (!accessToken) return null;
    return await authService.validateToken(accessToken, null, 'access');
}

/**
 * Handle live chat message broadcasting
 * @param {Object} fastify - Fastify instance
 * @param {number|string} userId - User ID sending the message
 * @param {string} message - Message content
 * @returns {Object} - Result object with success status and error if any
 */
export async function handleLiveChatMessage(fastify, userId, message) {
    // Vérifier d'abord si l'utilisateur est bien connecté
    const isConnected = fastify.connections.has(userId);
    if (!isConnected) {
        return { success: false, error: 'You must be connected to send messages' };
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return { success: false, error: 'Invalid message' };
    }

    if (message.trim().length > 1000) {
        return { success: false, error: 'Message too long (max 1000 characters)' };
    }

    const user = fastify.db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
    if (!user) {
        return { success: false, error: 'User not found' };
    }

    const payload = {
        type: 'livechat',
        user: user.username,
        message: message.trim()
    };

    broadcastToAllExceptSender(fastify, payload, userId);
    
    return { success: true };
}

/**
 * Handle direct message between users
 * @param {Object} fastify - Fastify instance
 * @param {number|string} senderId - Sender's user ID
 * @param {string} recipientUsername - Username of message recipient
 * @param {string} message - Message content
 * @returns {Object} - Result object with success status and warnings/errors
 */
export async function handleDirectMessage(fastify, senderId, recipientUsername, message) {
    // Vérifier d'abord si l'expéditeur est bien connecté
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

    if (message.trim().length > 1000) {
        return { success: false, error: 'Message too long (max 1000 characters)' };
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

    // Vérifier si l'expéditeur est bloqué par le destinataire
    const isBlocked = fastify.db.prepare(`
        SELECT 1 FROM blocks 
        WHERE (blocker_id = ? AND blocked_id = ?) 
           OR (blocker_id = ? AND blocked_id = ?)
    `).get(recipientUser.id, senderId, senderId, recipientUser.id);

    if (isBlocked) {
        return { success: false, error: 'Cannot send message due to block status' };
    }

    // Vérifier si le destinataire est connecté
    const isRecipientConnected = fastify.connections.has(recipientUser.id);
    if (!isRecipientConnected) {
        return { success: false, error: 'Recipient is offline. Cannot send message to offline users.' };
    }

    const payload = {
        type: 'direct_message',
        user: sender.username,
        recipient: recipientUsername,
        message: message.trim()
    };

    const delivered = sendToUser(fastify, recipientUser.id, payload);
    
    if (!delivered) {
        return { success: false, error: 'Failed to deliver message. Recipient may have disconnected.' };
    }

    return { success: true };
}

/**
 * Récupère la liste des utilisateurs en ligne
 * @param {Object} fastify - Fastify instance
 * @returns {Promise<Array>} - Liste des usernames en ligne
 */
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

/**
 * Envoie la liste des utilisateurs en ligne à un utilisateur spécifique
 * @param {Object} fastify - Fastify instance
 * @param {number|string} userId - User ID to send the list to
 */
export async function sendOnlineUsersList(fastify, userId) {
    const onlineUsers = await getOnlineUsers(fastify);
    const payload = {
        type: 'onlines',
        users: onlineUsers
    };
    
    sendToUser(fastify, userId, payload);
}

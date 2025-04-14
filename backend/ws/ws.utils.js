const redis = require('../redis/redisClient');
const authService = require('../jwt/services/auth.service');

// This function closes a WebSocket connection for a specific user
// It takes the userId, close code, reason, and whether to update the status
// It removes the connection from the map and updates Redis
// It broadcasts the offline status to other clients
// It returns true if the connection was closed successfully, false otherwise
async function closeUserWebSocket(fastify, userId, code = 1000, reason = "Connection closed", updateStatus = false) {
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

// This function closes all WebSocket connections
// It takes the fastify instance, close code, and reason
// It clears the connections map and Redis online users set
// It returns the number of closed connections
async function closeAllWebSockets(fastify, code = 1000, reason = "Server shutdown") {
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

// This function broadcasts a message to all connected clients
// It takes the fastify instance and the payload
// It converts the payload to a string if it's not already
// It sends the message to each connected socket
// It returns the number of sent messages
function broadcastToAllClients(fastify, payload) {
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

// This function broadcasts a message to all connected clients except the sender
// It takes the fastify instance, payload, and the userId of the sender
// It converts the payload to a string if it's not already
// It sends the message to each connected socket except the sender's
function broadcastToAllExceptSender(fastify, payload, excludeUserId) {
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

// This function sends a message to a specific user
// It takes the fastify instance, userId, and payload
// It converts the payload to a string if it's not already
// It checks if the socket is open before sending the message
// It returns true if the message was sent, false otherwise
function sendToUser(fastify, userId, payload) {
    const socket = fastify.connections.get(userId);
    
    if (socket && socket.readyState === 1) {
        const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
        socket.send(message);
        return true;
    }
    
    return false;
}

// This function broadcasts the user's online status to all clients
// It takes the fastify instance, userId, and online status
// It retrieves the user's username from the database
// It creates a payload with the user's status and broadcasts it
// It returns true if the user was found and the message was sent, false otherwise
async function broadcastUserStatus(fastify, userId, isOnline) {
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
async function updateUserOnlineStatus(userId, isOnline) {
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
async function isUserOnline(userId) {
    return await redis.sismember('online_users', userId.toString());
}

// This function validates the WebSocket token
// It checks if the token is valid using the authService
async function validateWebSocketToken(accessToken) {
    if (!accessToken) return null;
    return await authService.validateToken(accessToken, null, 'access');
}

// This function handles live chat messages
// It takes the fastify instance, userId, and message as parameters
// It checks if the user is connected and if the message is valid
// It retrieves the user's username from the database
// It creates a payload with the message and broadcasts it to all clients
async function handleLiveChatMessage(fastify, userId, message) {
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

// This function handles direct messages
// It takes the fastify instance, senderId, recipientUsername, and message as parameters
// It checks if the sender is connected and if the message is valid
// It retrieves the sender's username and checks if the recipient exists
// It checks if the sender is blocked by the recipient
// It checks if the recipient is connected
// It creates a payload with the message and sends it to the recipient
// It returns true if the message was sent, false otherwise
async function handleDirectMessage(fastify, senderId, recipientUsername, message) {
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
        message: message.trim()
    };

    const delivered = sendToUser(fastify, recipientUser.id, payload);
    
    if (!delivered) {
        return { success: false, error: 'Failed to deliver message. Recipient may have disconnected.' };
    }

    return { success: true };
}

// This function retrieves the list of online users
// It takes the fastify instance as a parameter
// It retrieves the online user IDs from Redis
// It creates a map of usernames and returns it
// It returns an empty array if no online users are found
// It returns an object with usernames as keys and true as values
async function getOnlineUsers(fastify) {
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
async function sendOnlineUsersList(fastify, userId) {
    const onlineUsers = await getOnlineUsers(fastify);
    const payload = {
        type: 'onlines',
        users: onlineUsers
    };
    
    sendToUser(fastify, userId, payload);
}

module.exports = {
    closeUserWebSocket,
    closeAllWebSockets,
    broadcastToAllClients,
    broadcastToAllExceptSender,
    sendToUser,
    broadcastUserStatus,
    updateUserOnlineStatus,
    isUserOnline,
    validateWebSocketToken,
    handleLiveChatMessage,
    handleDirectMessage,
    getOnlineUsers,
    sendOnlineUsersList
};

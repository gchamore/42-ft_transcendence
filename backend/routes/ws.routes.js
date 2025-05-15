import * as wsUtils from '../ws/ws.utils.js';
import wsService from '../ws/ws.service.js';
import authService from '../auth/auth.service.js';
import authUtils from '../auth/auth.utils.js';


export async function wsRoutes(fastify, options) {
	/*** 📌 Route: live chat messages ***/
	// Route to handle live chat messages
	// It receives a message from the user and broadcasts it to all connected users
	// It returns a success message if the message is sent successfully
	// It requires the user to be authenticated
	// It uses the WebSocket connection to send the message
	fastify.post('/live_chat_message', async (request, reply) => {
		const userId = String(request.user.userId);
		const { message } = request.body;

		const result = await wsUtils.handleLiveChatMessage(fastify, userId, message);

		if (!result.success) {
			return reply.code(400).send({ success: false, error: result.error });
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
		const senderId = String(request.user.userId);
		const { to, message } = request.body;

		const result = await wsUtils.handleDirectMessage(fastify, senderId, to, message);

		if (!result.success) {
			return reply.code(400).send({ success: false, error: result.error });
		}

		if (result.warning) {
			return reply.code(200).send({ success: false, warning: result.warning });
		}

		return { success: true };
	});

	fastify.get('/chats/:username', async (request, reply) => {
		const userId_1 = request.user.userId;
		const to_username = request.params.username;

		if (!to_username)
			return reply.code(400).send({ success: false, error: "Receiver username is required" });

		const checked_username = authUtils.checkUsername(fastify, to_username);
		if (typeof checked_username === 'object' && checked_username.error)
			return reply.status(400).send({ success: false, error: checked_username.error });

		const user2 = fastify.db.prepare("SELECT id FROM users WHERE username = ?").get(checked_username);
		if (!user2) {
			return reply.code(404).send({ success: false, error: 'User not found' });
		}
		const userId_2 = user2.id;

		if (userId_1 === userId_2) {
			return reply.code(400).send({ success: false, error: "You cannot chat with yourself" });
		}

		let chat = fastify.db.prepare(`
			SELECT * FROM chats
			WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
		`).get(userId_1, userId_2, userId_2, userId_1);

		if (!chat) {
			const info = fastify.db.prepare(`
			INSERT INTO chats (user1_id, user2_id) VALUES (?, ?)
		`).run(userId_1, userId_2);

			chat = { id: info.lastInsertRowid };
		}

		// Récupère les messages du chat
		const messages = fastify.db.prepare(`
			SELECT chat_messages.id, chat_messages.content, chat_messages.sent_at, users.username AS sender
			FROM chat_messages
			JOIN users ON users.id = chat_messages.sender_id
			WHERE chat_id = ?
			ORDER BY sent_at ASC
		`).all(chat.id);

		return reply.code(200).send({ success: true, messages });
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
	fastify.get('/ws', { websocket: true }, async (connection, request) => {
		try {
			fastify.log.info('Starting WebSocket connection setup...');

			// Validate the tokens
			const accessToken = request.cookies?.accessToken;
			const refreshToken = request.cookies?.refreshToken;
			const db = request.server.db;

			if (!accessToken && !refreshToken) {
				fastify.log.warn('No access and refresh token provided');
				return reply.code(401).send({ success: false, message: 'No token provided' });
			}

			const result = await authService.validate_and_refresh_Tokens(fastify, accessToken, refreshToken);
			if (!result.success) {
				fastify.log.info('Invalid or expired token');

				const decoded = jwt.decode(accessToken || refreshToken);
				const userId = decoded?.userId;

				if (userId) {
					const user = fastify.db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
					if (user) {
						await wsUtils.handleAllUserConnectionsClose(fastify, String(userId), user.username, 'Invalid token from middleware');
					}
				}
				return reply
					.code(401)
					.clearCookie('accessToken', cookieOptions)
					.clearCookie('refreshToken', cookieOptions)
					.send({ success: false, message: 'Invalid or expired token' });
			}

			if (result.newAccessToken) {
				fastify.log.info('New access token generated, updating cookie');
				authUtils.ft_setCookie(reply, result.newAccessToken, 15, isLocal);
			}

			fastify.log.info('Token validated, fetching user info...');
			const userId = String(result.userId);
			const user = db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
			if (!user) {
				fastify.log.warn('User not found');
				return;
			}

			fastify.log.info(`User found: ${user.username}`);

			// Generate a unique ID for the connection
			const connectionId = wsService.generateConnectionId();

			fastify.log.info(`New WebSocket connection [ID: ${connectionId}] for user: ${user.username} (${userId})`);

			// Establish the new connection
			await wsService.establishConnection(fastify, connection, userId, connectionId);
			fastify.log.info('New connection established');

			// Set up WebSocket events
			wsService.setupWebSocketEvents(fastify, connection, userId, user.username, connectionId);
			fastify.log.info('WebSocket events setup called\n');

		} catch (error) {
			fastify.log.error(error, `WebSocket /ws error caught:`);
			wsUtils.handleConnectionError(fastify, connection, error);
		}
	});

}
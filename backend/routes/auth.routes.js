import bcrypt from "bcrypt";
import authService from '../auth/auth.service.js';
import authUtils from '../auth/auth.utils.js';
import jwt from 'jsonwebtoken';
import * as wsUtils from '../ws/ws.utils.js';
const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_key';

export async function authRoutes(fastify, options) {

	/*** 📌 Route: REGISTER ***/
	// Register a new user
	// Hash the password and store it in the database
	// Generate access and refresh tokens
	// Set cookies for the tokens
	// Return the user information and tokens in the response
	// The access token is valid for 15 minutes and the refresh token for 7 days
	// The tokens are stored in Redis with the userId as key
	fastify.post("/register", async (request, reply) => {
		const { username, password } = request.body;

		fastify.log.debug({ body: request.body }, "Attempting to register a new user");

		const trimmedUsername = username ? username.trim() : '';

		// Verify if the required fields are present
		if (!trimmedUsername || !password) {
			fastify.log.warn("Failed registration: username or password missing");
			return reply.code(400).send({ error: "Username and password are required" });
		}

		const capitalizedUsername = trimmedUsername.charAt(0).toUpperCase() + trimmedUsername.slice(1).toLowerCase();

		// // Validate username format
		// const usernameRegex = /^[a-zA-Z0-9_]{3,15}$/;
		// if (!usernameRegex.test(capitalizedUsername)) {
		// 	return reply.code(400).send({
		// 		error: "Username must be 3-20 characters, letters/numbers/underscores only."
		// 	});
		// }

		// // Validate password strength
		// const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
		// if (!passwordRegex.test(password)) {
		// 	return reply.code(400).send({
		// 		error: "Password must be at least 8 characters, include uppercase, lowercase, number, and special character."
		// 	});
		// }

		// Verify if the username already exists in the database
		const existingUser = fastify.db.prepare("SELECT id FROM users WHERE username = ?").get(capitalizedUsername);
		if (existingUser) {
			fastify.log.warn(`Failed registration: Username already taken (${capitalizedUsername})`);
			return reply.code(400).send({ error: "Username already taken" });
		}

		// Register the user in the database
		try {
			// Hash the password using bcrypt
			const hashedPassword = await authUtils.hashPassword(password);

			// Insert the user into the database
			const result = fastify.db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run(capitalizedUsername, hashedPassword);
			const newUserId = result.lastInsertRowid;

			// Get the newly created user from the database
			const newUser = fastify.db.prepare("SELECT id, username FROM users WHERE id = ?").get(newUserId);

			// Generate the access and refresh tokens for the user
			const { accessToken, refreshToken } = await authService.generateTokens(newUser.id);
			const isLocal = request.headers.host.startsWith("localhost");

			// Send the response with the tokens in cookies
			authUtils.setCookie(reply, accessToken, 15, isLocal);
			authUtils.setCookie(reply, refreshToken, 7, isLocal);

			return reply.code(201).send({
				success: true,
				message: "User registered and logged in successfully",
				username: newUser.username,
				id: newUser.id,
				avatar: '/assets/avatar.png',
			});

		} catch (error) {
			fastify.log.error(error, "Error during registration");
			return reply.code(500).send({
				error: "Registration failed",
				details: error.message
			});
		}
	});


	/*** 📌 Route: UNREGISTER ***/
	// Unregister a user
	// Verify if the user exists
	// Verify if the password is correct
	// Revoke the user's tokens
	// Anonymize the user's games instead of deleting them
	// Delete the user from the database
	// Return a success message
	fastify.post("/unregister", async (request, reply) => {
		const userId = request.user.userId;
		const { password } = request.body;

		try {
			const user = fastify.db.prepare("SELECT username, password, is_google_account FROM users WHERE id = ?").get(userId);
			if (!user) {
				fastify.log.warn(`Failed to delete: User not found (ID: ${userId})`);
				return reply.code(404).send({ error: "User not found" });
			}

			// 📌 Log info
			fastify.log.info(`${user.username} Attempting to delete account`);

			// user Google without password
			if (user.is_google_account && !user.password) {
				fastify.log.info(`${user.username} is a Google-only user with no password. Skipping password check.`);
			}

			// normal user or Google user with password
			else {
				// Check if the required fields are present
				if (!password) {
					fastify.log.warn("Failed to delete: missing fields");
					return reply.code(400).send({ error: "Username and password are required" });
				}

				// Check if the password is correct
				const validPassword = await bcrypt.compare(password, user.password);
				if (!validPassword) {
					fastify.log.warn(`Failed to delete: Invalid password for user ${user.username}`);
					return reply.code(401).send({ error: "Invalid password" });
				}
			}

			// Using a transaction for atomic deletion
			const transaction = fastify.db.transaction(async () => {
				fastify.log.info("Revoking user tokens");
				await authService.revokeTokens(userId);

				fastify.log.info("Starting user data deletion");

				// Anonymize the user's games by replacing their ID with 0 (deleted user)
				fastify.db.prepare(`
				    UPDATE games 
				    SET player1_id = CASE 
				            WHEN player1_id = ? THEN 0 
				            ELSE player1_id 
				        END,
				        player2_id = CASE 
				            WHEN player2_id = ? THEN 0 
				            ELSE player2_id 
				        END,
				        winner_id = CASE 
				            WHEN winner_id = ? THEN 0 
				            ELSE winner_id 
				        END
				    WHERE player1_id = ? OR player2_id = ?
				`).run(userId, userId, userId, userId, userId);

				fastify.log.debug(`Games anonymized for user: ${user.username}`);
				fastify.db.prepare(`
					DELETE FROM friendships WHERE user_id = ? OR friend_id = ?
				`).run(userId, userId);
				fastify.log.debug(`Friendships deleted for user: ${user.username}`);
				fastify.db.prepare(`
					DELETE FROM blocks WHERE blocker_id = ? OR blocked_id = ?
				`).run(userId, userId);
				fastify.log.debug(`Friendship blocked links deleted for user: ${user.username}`);

				// Delete the user from the database
				fastify.db.prepare("DELETE FROM users WHERE id = ?").run(userId);
				fastify.log.debug(`User deleted: ${user.username}`);
			});

			// Execute the transaction
			transaction();

			await wsUtils.handleAllUserConnectionsClose(fastify, userId, user.username, 'User unregistered');

			fastify.log.info({
				username: user.username,
				success: true
			}, "Account deleted and games anonymized successfully");

			return reply.send({
				success: true,
				message: "User deleted and games anonymized successfully"
			});

		} catch (error) {
			fastify.log.error(error, `Error while deleting user`);
			return reply.code(500).send({
				error: "Failed to delete user"
			});
		}
	});

	/*** 📌 Route: IS USER ***/
	// Check if a user exists in the database
	// If the user exists, return true
	// If the user does not exist, return false
	// This route is used to check if a username is already taken
	fastify.get("/isUser/:username", async (request, reply) => {
		const { username } = request.params;
		fastify.log.info(`Verfication of user existence: ${username}`);

		const user = fastify.db.prepare("SELECT * FROM users WHERE username = ?").get(username);
		const exists = !!user;

		if (exists) {
			fastify.log.info(`User found: ${username}\n`);
		} else {
			fastify.log.info(`User not found: ${username}\n`);
		}

		return reply.send({ exists });
	});

	/*** 📌 Route: GET USER ID ***/
	// Get the user ID from the database using the username
	// If the user exists, return the user ID
	// If the user does not exist, return an error
	// This route is used to get the user ID for the WebSocket connection
	fastify.post("/getUserId", async (request, reply) => {
		const { username } = request.body;

		if (!username) {
			fastify.log.warn("Attempt to get user ID without username");
			return reply.code(400).send({ error: "Username is required" });
		}

		fastify.log.info(`Searching for ID for user: ${username}`);

		const user = fastify.db.prepare("SELECT id FROM users WHERE username = ?").get(username);
		if (!user) {
			fastify.log.warn(`User not found: ${username}`);
			return reply.code(404).send({ error: "User not found" });
		}

		fastify.log.info(`User ID found for ${username}: ${user.id}`);
		return { success: true, id: user.id };
	});

	/*** 📌 Route: LOGIN ***/
	// Login a user
	// Verify if the username and password are correct
	// If the user has 2FA enabled, generate a temporary token for 2FA verification
	// If the credentials are valid and the user does not have 2FA enabled, generate the access and refresh tokens
	// The tokens are stored in Redis with the userId as key
	// Set cookies for the tokens
	// Return the user information and tokens in the response
	// The access token is valid for 15 minutes and the refresh token for 7 days
	fastify.post("/login", async (request, reply) => {
		try {
			const { username, password } = request.body;
			fastify.log.info({ username }, "Tentative de connexion");

			// Verify if user and password are provided and if password is valid using bcrypt
			const user = fastify.db.prepare("SELECT * FROM users WHERE username = ?").get(username);
			if (!user || !(await bcrypt.compare(password, user.password))) {
				fastify.log.warn(`Login failed for: ${username}`);
				return reply.code(401).send({ error: "Invalid credentials" });
			}

			// Vérifie si 2FA activée
			if (user.twofa_secret) {
				try {
					const tempToken = await authService.generateTempToken({ userId: user.id }, "2fa", 300);
					return reply.code(200).send({
						step: "2fa_required",
						message: "2FA is enabled. Please provide the verification code.",
						temp_token: tempToken
					});
				} catch (twoFaError) {
					fastify.log.error(twoFaError, `2FA token generation error in google Oauth:`);
					throw new Error('Failed to generate 2FA token in google Oauth');
				}
			}

			// Generate access and refresh tokens
			const { accessToken, refreshToken } = await authService.generateTokens(user.id);

			// Check if the application is running locally or in production
			const isLocal = request.headers.host.startsWith("localhost");

			// Set the cookies for the tokens
			authUtils.setCookie(reply, accessToken, 15, isLocal); // accessToken : 15 min
			authUtils.setCookie(reply, refreshToken, 7, isLocal); // refreshToken : 7 jours

			reply.code(201).send({
				success: true,
				message: "Login successful",
				username: user.username,
				id: user.id
			});
		} catch (error) {
			fastify.log.error(error, "Error during login attempt");
			return reply.code(500).send({
				error: "Login failed"
			});
		}
	});


	/*** 📌 Route: REFRESH TOKEN ***/
	// Refresh the access token using the refresh token
	// Verify if the refresh token is valid
	// If the refresh token is valid, generate a new access token
	// Set the new access token in a cookie
	// Return the new access token and user information in the response
	// The access token is valid for 15 minutes
	// The refresh token is valid for 7 days
	fastify.post("/refresh", async (request, reply) => {
		const refreshToken = request.cookies.refreshToken;
		// Check if the refresh token is provided
		if (!refreshToken) {
			return reply.code(401).send({ error: "No refresh token provided" });
		}

		try {
			// Vérifier si le refresh token est valide
			const newAccessToken = await authService.refreshAccessToken(refreshToken);
			if (!newAccessToken) {
				return reply.code(401).send({ error: "Invalid refresh token" });
			}

			// Décoder le token pour obtenir l'userId
			const decoded = jwt.verify(newAccessToken, JWT_SECRET);

			// Récupérer les informations de l'utilisateur
			const user = fastify.db.prepare("SELECT username FROM users WHERE id = ?").get(decoded.userId);

			// Check if the application is running locally or in production
			const isLocal = request.headers.host.startsWith("localhost");

			// Définir le nouveau cookie avec le même format que verify_token
			authUtils.setCookie(reply, newAccessToken, 15, isLocal); // accessToken : 15 min

			fastify.log.info('Access token refreshed successfully for user:', user.username);

			return reply.code(200).send({
				valid: true,
				username: user.username
			});

		} catch (error) {
			fastify.log.error(error);
			return reply.code(500).send({
				error: "Failed to refresh token"
			});
		}
	});

	/*** 📌 Route: LOGOUT ***/
	// Logout a user
	// Verify if the user is logged in
	// Revoke the user's tokens
	// Clear the cookies for the tokens
	// Close the WebSocket connection for the user
	fastify.post("/logout", async (request, reply) => {
		const userId = request.user.userId;

		fastify.log.info('Processing logout for user:', userId);

		try {
			// Vérifier si l'utilisateur existe dans la base de données
			const user = fastify.db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
			if (!user) {
				fastify.log.info(`User not found for logout: ID ${userId}`);
				return reply.code(404).send({ error: "User not found" });
			}
			// Fermer la connexion WebSocket pour l'utilisateur et mettre à jour son statut
			await wsUtils.handleAllUserConnectionsClose(fastify, userId, user.username, 'User Logged Out');
			// Révoquer les tokens de l'utilisateur
			await authService.revokeTokens(userId);
			// Vérification de l'environnement local ou de production
			const isLocal = request.headers.host.startsWith("localhost");
			const cookieOptions = {
				path: '/',
				secure: !isLocal,
				httpOnly: true,
				sameSite: 'None'
			};

			fastify.log.info('Logout successful for user:', userId);

			// Effacer les cookies pour accessToken et refreshToken
			return reply
				.code(200)
				.clearCookie('accessToken', cookieOptions)
				.clearCookie('refreshToken', cookieOptions)
				.header('Access-Control-Allow-Credentials', 'true')
				.header('Access-Control-Allow-Origin', request.headers.origin || 'https://localhost:8443')
				.send({ success: true, message: "Logged out successfully" });

		} catch (error) {
			fastify.log.error('Logout error:', error);
			return reply.code(500).send({
				error: 'Logout failed',
				details: error.message // Ajout d'un message d'erreur détaillé
			});
		}
	});


	/*** 📌 Route: REVOKE TOKEN ***/
	// Revoke a user's tokens
	// Verify if the user ID is provided
	// Verify if the user exists in the database
	// Close the WebSocket connection for the user
	// Revoke the user's tokens
	// Clear the cookies for the tokens
	fastify.post("/revoke", async (request, reply) => {
		const { userId } = request.body;

		if (!userId) {
			fastify.log.info("Attempt to revoke without userId");
			return reply.code(400).send({ error: "User ID is required" });
		}

		try {
			// Verify if the user exists in the database
			const user = fastify.db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
			if (!user) {
				fastify.log.info(`User not found in fastify.db for revoke: ID ${userId}`);
				return reply.code(404).send({ error: "User not found" });
			}

			fastify.log.info(`Revoking tokens for user: ${user.username} (ID: ${userId})`);

			// Update the user's online status in the database before closing the WebSocket
			await wsUtils.updateUserOnlineStatus(userId, false);
			await wsUtils.broadcastUserStatus(fastify, userId, false);

			// Close the WebSocket connection for the user
			await wsUtils.handleAllUserConnectionsClose(fastify, userId, user.username, 'User Revoked');

			// Revoke the user's tokens
			await authService.revokeTokens(userId);

			// Check if the application is running locally or in production
			const isLocal = request.headers.host.startsWith("localhost");

			const cookieOptions = {
				path: '/',
				secure: !isLocal,
				httpOnly: true,
				sameSite: 'None'
			};

			fastify.log.info(`Tokens revoked successfully for user: ${user.username}`);

			return reply
				.clearCookie('accessToken', cookieOptions)
				.clearCookie('refreshToken', cookieOptions)
				.header('Access-Control-Allow-Credentials', 'true')
				.header('Access-Control-Allow-Origin', request.headers.origin || 'https://localhost:8443')
				.send({ success: true, message: "Logged out successfully" });

		} catch (error) {
			fastify.log.error('Revoke error:', error);
			return reply.code(500).send({
				error: 'Revoke failed'
			});
		}
	});

	/*** 📌 Route: VERIFY TOKEN ***/
	// Verify if the access token is valid
	// If the access token is valid, return the user information
	// If the access token is expired, try to refresh it using the refresh token
	// If both tokens are invalid, clear the cookies and return an error

	fastify.post("/verify_token", async (request, reply) => {
		const accessToken = request.cookies?.accessToken;
		const refreshToken = request.cookies?.refreshToken;

		const isLocal = request.headers.host.startsWith("localhost");
		const cookieOptions = {
			path: '/',
			secure: !isLocal,
			httpOnly: true,
			sameSite: !isLocal ? 'None' : 'Lax'
		};

		try {
			fastify.log.info('Verify Token Request:', {
				hasAccessToken: !!accessToken,
				hasRefreshToken: !!refreshToken,
				cookies: request.cookies
			});

			if (!accessToken && !refreshToken) {
				fastify.log.info('No token provided');
				return reply.code(401).send({ valid: false, message: 'No token provided' });
			}

			const result = await authService.validate_and_refresh_Tokens(fastify, accessToken, refreshToken);

			if (!result.success) {
				fastify.log.info('Invalid or expired token');

				const decoded = jwt.decode(accessToken || refreshToken);
				const userId = decoded?.userId;

				if (userId) {
					const user = fastify.db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
					if (user) {
						await wsUtils.handleAllUserConnectionsClose(fastify, userId, user.username, 'Invalid token from middleware');
					}
				}
				return reply
					.code(401)
					.clearCookie('accessToken', cookieOptions)
					.clearCookie('refreshToken', cookieOptions)
					.send({ valid: false, message: 'Invalid or expired token' });
			}

			if (result.newAccessToken) {
				fastify.log.info('New access token generated, updating cookie');
				authUtils.setCookie(reply, result.newAccessToken, 15, isLocal);
			}

			const user = fastify.db.prepare("SELECT username FROM users WHERE id = ?").get(result.userId);
			if (!user) {
				fastify.log.warn(`User not found for ID: ${result.userId}`);
				return reply
					.code(401)
					.clearCookie('accessToken', cookieOptions)
					.clearCookie('refreshToken', cookieOptions)
					.send({ valid: false, message: 'User not found' });
			}

			fastify.log.info('Token verified successfully for user:', user.username);
			return reply.send({ valid: true, username: user.username });

		} catch (error) {
			fastify.log.error(error, 'Error during token verification');
			return reply
				.code(500)
				.clearCookie('accessToken', cookieOptions)
				.clearCookie('refreshToken', cookieOptions)
				.send({ valid: false, message: 'Token verification failed' });
		}
	});
}

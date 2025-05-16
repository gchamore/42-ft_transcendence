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

		if (!username || !password)
			return reply.code(400).send({ success: false, error: "Username and password are required" });

		// Register the user in the database
		try {
			const checked_username = authUtils.checkUsername(fastify, username);
			if (typeof checked_username === 'object' && checked_username.error)
				return reply.status(400).send({ success: false, error: checked_username.error });

			// Validate password strength
			const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
			if (!passwordRegex.test(password)) {
				return reply.code(400).send({ success: false, 
					error: "Password must be at least 8 characters, include uppercase, lowercase, number, and special character."
				});
			}
			const existingUser = fastify.db.prepare("SELECT id FROM users WHERE username = ?").get(checked_username);
			if (existingUser) {
				fastify.log.warn(`Failed registration: Username already taken (${checked_username})`);
				return reply.code(400).send({ success: false, error: "Username already taken" });
			}
			// Hash the password using bcrypt
			const hashedPassword = await authUtils.hashPassword(password);

			// Insert the user into the database
			const result = fastify.db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run(checked_username, hashedPassword);
			const newUserId = result.lastInsertRowid;

			// Get the newly created user from the database
			const newUser = fastify.db.prepare("SELECT id, username FROM users WHERE id = ?").get(newUserId);

			// Generate the access and refresh tokens for the user
			const { accessToken, refreshToken } = await authService.generateTokens(newUser.id);

			// Send the response with the tokens in cookies
			authUtils.ft_setCookie(reply, accessToken, 15);
			authUtils.ft_setCookie(reply, refreshToken, 7);

			return reply.code(201).send({
				success: true,
				message: "User registered and logged in successfully",
				username: newUser.username,
				id: newUser.id,
				avatar: '/assets/avatar.png'
			});

		} catch (error) {
			fastify.log.error(error, "Error during registration");
			return reply.code(500).send({ success: false, error: "Internal server error while registering user" });
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
			// Check if the user exists in the database
			const user = fastify.db.prepare("SELECT username, password, is_google_account FROM users WHERE id = ?").get(userId);
			if (!user) {
				fastify.log.warn(`Failed to delete: User not found (ID: ${userId})`);
				return reply.code(404).send({ success: false, error: "User not found" });
			}

			fastify.log.info(`${user.username} Attempting to delete account`);

			// if user Google without password
			if (user.is_google_account && !user.password) {
				fastify.log.info(`${user.username} is a Google-only user with no password. Skipping password check.`);
			}

			// normal user or Google user with password
			else {
				// Check if the required fields are present
				if (!password) {
					fastify.log.warn("Failed to delete: missing fields");
					return reply.code(400).send({ success: false, error: "Password are required" });
				}

				// Check if the password is correct
				const validPassword = await bcrypt.compare(password, user.password);
				if (!validPassword) {
					fastify.log.warn(`Failed to delete: Invalid password for user ${user.username}`);
					return reply.code(401).send({ success: false, error: "Invalid password" });
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

				fastify.db.prepare(`
					DELETE FROM friendships WHERE user_id = ? OR friend_id = ?
				`).run(userId, userId);
				fastify.db.prepare(`
					DELETE FROM blocks WHERE blocker_id = ? OR blocked_id = ?
				`).run(userId, userId);
				fastify.db.prepare(`
				    UPDATE chat_messages SET sender_id = 0 WHERE sender_id = ?
				`).run(userId);
				fastify.db.prepare(`
				    UPDATE chats
				    SET user1_id = CASE WHEN user1_id = ? THEN 0 ELSE user1_id END,
				        user2_id = CASE WHEN user2_id = ? THEN 0 ELSE user2_id END
				    WHERE user1_id = ? OR user2_id = ?
				`).run(userId, userId, userId, userId);

				// Delete the user from the database
				fastify.db.prepare("DELETE FROM users WHERE id = ?").run(userId);
				fastify.log.info(`User deleted: ${user.username}`);
			});

			// Execute the transaction
			transaction();

			await wsUtils.handleAllUserConnectionsClose(fastify, String(userId), user.username, 'User unregistered');

			fastify.log.info(`Account deleted and games anonymized successfully`);

			return reply.code(200).send({
				success: true,
				message: "User deleted and games anonymized successfully"
			});

		} catch (error) {
			fastify.log.error(error, `Error while deleting user`);
			return reply.code(500).send({ success: false, error: "Internal server error while deleting user" });
		}
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

			if (!username || !password)
				return reply.code(400).send({ success: false, error: "Username and password are required" });
			const checked_username = authUtils.checkUsername(fastify, username);
			if (typeof checked_username === 'object' && checked_username.error) {
				return reply.status(400).send({ success: false, error: checked_username.error });
			}

			// Verify if user and password are provided and if password is valid using bcrypt
			const user = fastify.db.prepare("SELECT * FROM users WHERE username = ?").get(checked_username);
			if (!user) {
				fastify.log.warn(`Invalid credentials`);
				return reply.code(401).send({ success: false, error: "Invalid credentials" });
			}

			if (user.is_google_account) {
				fastify.log.warn(`This account uses Google login. Please sign in with Google.`);
				return reply.code(403).send({ success: false, error: "This account uses Google login. Please sign in with Google." });
			}

			if (!(await bcrypt.compare(password, user.password))) {
				fastify.log.warn(`Login failed for: ${checked_username}`);
				return reply.code(401).send({ success: false, error: "Invalid credentials" });
			}

			// Verify if 2FA is active for the user
			if (user.twofa_secret) {
				try {
					const tempToken = await authService.generateTempToken({ userId: user.id }, "2fa", 300);
					return reply.code(202).send({
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

			// Set the cookies for the tokens
			authUtils.ft_setCookie(reply, accessToken, 15); // accessToken : 15 min
			authUtils.ft_setCookie(reply, refreshToken, 7); // refreshToken : 7 jours

			return reply.code(200).send({
				success: true,
				message: "Login successful",
				id: user.id,
				username: user.username,
				email: user.email,
				avatar: user.avatar
			});
		} catch (error) {
			fastify.log.error(error, "Error during login attempt");
			return reply.code(500).send({ success: false, error: "Internal server error during login" });
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
			return reply.code(401).send({ success: false, error: "No refresh token provided" });
		}

		try {
			// Verify if the refresh token is valid
			const newAccessToken = await authService.refreshAccessToken(refreshToken);
			if (!newAccessToken) {
				return reply.code(401).send({ success: false, error: "Invalid refresh token" });
			}

			// Decode the new access token to get the userId
			const decoded = jwt.verify(newAccessToken, JWT_SECRET);

			// Recover the user information from the database
			const user = fastify.db.prepare("SELECT username FROM users WHERE id = ?").get(decoded.userId);

			// Define cookie options
			authUtils.ft_setCookie(reply, newAccessToken, 15);

			fastify.log.info('Access token refreshed successfully for user:', user.username);

			return reply.code(200).send({
				success: true,
				username: user.username
			});

		} catch (error) {
			fastify.log.error(error, `Error during token refresh`);
			return reply.code(500).send({ success: false, error: "Internal server error during token refresh" });
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
			// Verify if the user exists in the database
			const user = fastify.db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
			if (!user) {
				fastify.log.info(`User not found for logout: ID ${userId}`);
				return reply.code(404).send({ success: false, error: "User not found" });
			}
			// Close the WebSocket connection for the user
			await wsUtils.handleAllUserConnectionsClose(fastify, String(userId), user.username, 'User Logged Out');
			// Revoke the user's tokens
			await authService.revokeTokens(userId);

			const cookieOptions = {
				path: '/',
				secure: true,
				httpOnly: true,
				sameSite: 'None'
			};

			fastify.log.info('Logout successful for user:', userId);

			// Erase the cookies for the tokens
			return reply
				.code(200)
				.clearCookie('accessToken', cookieOptions)
				.clearCookie('refreshToken', cookieOptions)
				.header('Access-Control-Allow-Credentials', 'true')
				.header('Access-Control-Allow-Origin', request.headers.origin || 'https://localhost:8443')
				.send({ success: true, message: "Logged out successfully" });

		} catch (error) {
			fastify.log.error(error, 'Logout error:');
			return reply.code(500).send({ success: false, error: "Internal server error during logout" });
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
			return reply.code(400).send({ success: false, error: "User ID is required" });
		}

		try {
			// Verify if the user exists in the database
			const user = fastify.db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
			if (!user) {
				fastify.log.info(`User not found in fastify.db for revoke: ID ${userId}`);
				return reply.code(404).send({ success: false, error: "User not found" });
			}

			fastify.log.info(`Revoking tokens for user: ${user.username} (ID: ${userId})`);

			// Update the user's online status in the database before closing the WebSocket
			await wsUtils.updateUserOnlineStatus(userId, false);
			await wsUtils.broadcastUserStatus(fastify, userId, false);

			// Close the WebSocket connection for the user
			await wsUtils.handleAllUserConnectionsClose(fastify, String(userId), user.username, 'User Revoked');

			// Revoke the user's tokens
			await authService.revokeTokens(userId);

			const cookieOptions = {
				path: '/',
				secure: true,
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
			return reply.code(500).send({ success: false, error: "Internal server error during token revocation" });
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

		const cookieOptions = {
			path: '/',
			secure: true,
			httpOnly: true,
			sameSite: 'None'
		};

		try {
			// Check if the access token and refresh token are provided
			if (!accessToken && !refreshToken) {
				fastify.log.info('No token provided');
				return reply.code(200).send({ success: false, message: 'No token provided' });
			}
			// Validate the Access and if necessary, refresh the tokens
			const result = await authService.validate_and_refresh_Tokens(fastify, accessToken, refreshToken);

			if (!result.success) {
				// If the access token is invalid and the refresh token is also invalid
				fastify.log.info('Invalid or expired token');
				// Try to decode the token to get the userId
				// fastify.log.info(`Clearing cookies for invalid token : ${accessToken}`);
				// fastify.log.info(`Clearing cookies for invalid token : ${refreshToken}`);
				return reply
					.code(200)
					.clearCookie('accessToken', cookieOptions)
					.clearCookie('refreshToken', cookieOptions)
					.send({ success: false, message: 'Invalid or expired token' });
			}
			// If the access token has been refreshed, update the cookie
			if (result.newAccessToken) {
				fastify.log.info('New access token generated, updating cookie');
				authUtils.ft_setCookie(reply, result.newAccessToken, 15);
			}
			// If the tokens are valid, set the userId in the request object
			const user = fastify.db.prepare("SELECT * FROM users WHERE id = ?").get(result.userId);
			if (!user) {
				fastify.log.warn(`User not found for ID: ${result.userId}`);
				return reply
					.code(200)
					.clearCookie('accessToken', cookieOptions)
					.clearCookie('refreshToken', cookieOptions)
					.send({ success: false, message: 'User not found' });
			}

			fastify.log.info('Token verified successfully for user:', user.username);
			return reply.code(200).send({ success: true, username: user.username, id: user.id, email: user.email, avatar: user.avatar });

		} catch (error) {
			fastify.log.error(error, 'Error during token verification');
			return reply
				.code(500)
				.clearCookie('accessToken', cookieOptions)
				.clearCookie('refreshToken', cookieOptions)
				.send({ success: false, error: 'Internal server error during token verification' });
		}
	});
}

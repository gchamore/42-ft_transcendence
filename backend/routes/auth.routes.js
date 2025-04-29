import bcrypt from "bcrypt";
import authService from '../auth/auth.service.js';
import authUtils from '../auth/auth.utils.js';
import TwofaService from'../2fa/twofa.service.js';
import jwt from 'jsonwebtoken';
import * as wsUtils from '../ws/ws.utils.js';
const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_key';

export async function authRoutes(fastify, options) {
	const { db } = fastify;

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
	
		fastify.log.info({ body: request.body }, "Tentative d'inscription");

		const trimmedUsername = username ? username.trim() : '';
		
		// Verify if the required fields are present
		if (!trimmedUsername || !password) {
			fastify.log.warn("Échec d'inscription : username ou password manquant");
			return reply.code(400).send({ error: "Username and password are required" });
		}
	
		// Verify if the username already exists in the database
		const existingUser = db.prepare("SELECT id FROM users WHERE username = ?").get(trimmedUsername);
		if (existingUser) {
			fastify.log.warn(`Échec d'inscription : Username déjà pris (${trimmedUsername})`);
			return reply.code(400).send({ error: "Username already taken" });
		}

		// Register the user in the database
		try {
			// Hash the password using bcrypt
			const hashedPassword = await authUtils.hashPassword(password);
	
			// Insert the user into the database
			const result = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run(trimmedUsername, hashedPassword);
			const newUserId = result.lastInsertRowid;
	
			// Get the newly created user from the database
			const newUser = db.prepare("SELECT id, username FROM users WHERE id = ?").get(newUserId);
	
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
			fastify.log.error(error, "Erreur lors de l'inscription");
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
		const { username, password } = request.body;

		fastify.log.info({ username }, "Tentative de suppression de compte");

		try {
			// Check if the required fields are present
			if (!username || !password) {
				fastify.log.warn("Échec de suppression : champs manquants");
				return reply.code(400).send({ error: "Username and password are required" });
			}

			// Check if the user exists in the database
			const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
			if (!user) {
				fastify.log.warn(`Utilisateur non trouvé : ${username}`);
				return reply.code(404).send({ error: "User not found" });
			}

			// Check if the password is correct
			const validPassword = await bcrypt.compare(password, user.password);
			if (!validPassword) {
				fastify.log.warn(`Mot de passe incorrect pour : ${username}`);
				return reply.code(401).send({ error: "Invalid password" });
			}

			// Using a transaction for atomic deletion
			const transaction = db.transaction(async () => {
				fastify.log.info("Révocation des tokens de l'utilisateur");
				await authService.revokeTokens(user.id);

				fastify.log.info("Début de la suppression des données utilisateur");

				// Anonymize the user's games instead of deleting them
				db.prepare(`
                    UPDATE games 
                    SET player1_id = CASE 
                            WHEN player1_id = ? THEN NULL 
                            ELSE player1_id 
                        END,
                        player2_id = CASE 
                            WHEN player2_id = ? THEN NULL 
                            ELSE player2_id 
                        END,
                        winner_id = CASE 
                            WHEN winner_id = ? THEN NULL 
                            ELSE winner_id 
                        END
                    WHERE player1_id = ? OR player2_id = ?
                `).run(user.id, user.id, user.id, user.id, user.id);

				fastify.log.debug(`Parties anonymisées pour : ${username}`);

				// Delete the user from the database
				db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
				fastify.log.debug(`Compte supprimé : ${username}`);
			});

			// Execute the transaction
			transaction();

			fastify.log.info({
				username,
				success: true
			}, "Compte supprimé et parties anonymisées avec succès");

			return reply.send({
				success: true,
				message: "User deleted and games anonymized successfully"
			});

		} catch (error) {
			fastify.log.error(error, `Erreur lors de la suppression du compte : ${username}`);
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
		fastify.log.debug(`Vérification de l'existence de l'utilisateur : ${username}`);

		const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
		const exists = !!user;

		if (exists) {
			fastify.log.info(`Utilisateur trouvé : ${username}\n`);
		} else {
			fastify.log.info(`Utilisateur non trouvé : ${username}\n`);
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
			fastify.log.warn("Tentative de récupération d'ID sans username");
			return reply.code(400).send({ error: "Username is required" });
		}

		fastify.log.info(`Recherche de l'ID pour l'utilisateur: ${username}`);

		const user = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
		if (!user) {
			fastify.log.warn(`Utilisateur non trouvé: ${username}`);
			return reply.code(404).send({ error: "User not found" });
		}

		fastify.log.info(`ID trouvé pour ${username}: ${user.id}`);
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
			const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
			if (!user || !(await bcrypt.compare(password, user.password))) {
				fastify.log.warn(`Échec de connexion pour: ${username}`);
				return reply.code(401).send({ error: "Invalid credentials" });
			}

			// Vérifie si 2FA activée
			if (user.twofa_secret) {
				// Génère un token temporaire limité à la 2FA
				const tempToken = await TwofaService.generateTemp2FAToken(user.id);
				return reply.code(200).send({
					step: "2fa_required",
					message: "2FA is enabled. Please provide the verification code.",
					temp_token: tempToken
				});
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
			fastify.log.error(error, "Erreur lors de la tentative de connexion");
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
			const user = db.prepare("SELECT username FROM users WHERE id = ?").get(decoded.userId);

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
		// Middleware used because the user is already authenticated
		const userId = request.user.userId;
		const token = request.cookies?.accessToken;

		fastify.log.info('Processing logout for user:', userId);

		try {
			// Update the user's online status in the database before closing the WebSocket
			await wsUtils.updateUserOnlineStatus(userId, false);
			await wsUtils.broadcastUserStatus(fastify, userId, false);

			// Close the WebSocket connection for the user
			await wsUtils.closeUserWebSocket(fastify, userId, 1000, "User logged out");

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

			fastify.log.info('Logout successful for user:', userId);
			
			// Clear the cookies for accessToken and refreshToken
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
				error: 'Logout failed'
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
			fastify.log.warn("Tentative de révocation sans userId");
			return reply.code(400).send({ error: "User ID is required" });
		}

		try {
			// Verify if the user exists in the database
			const user = db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
			if (!user) {
				fastify.log.warn(`Utilisateur non trouvé pour la révocation: ID ${userId}`);
				return reply.code(404).send({ error: "User not found" });
			}

			fastify.log.info(`Révocation des tokens pour l'utilisateur: ${user.username} (ID: ${userId})`);

			// Update the user's online status in the database before closing the WebSocket
			await wsUtils.updateUserOnlineStatus(userId, false);
			await wsUtils.broadcastUserStatus(fastify, userId, false);

			// Close the WebSocket connection for the user
			await wsUtils.closeUserWebSocket(fastify, userId, 1000, "Tokens revoked");

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

			fastify.log.info(`Tokens révoqués avec succès pour l'utilisateur: ${user.username}`);

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

		fastify.log.info('Verify Token Request:', {
			hasAccessToken: !!accessToken,
			hasRefreshToken: !!refreshToken,
			cookies: request.cookies
		});

		// Si aucun token n'est fourni, retourner simplement valid: false
		if (!accessToken && !refreshToken) {
			fastify.log.info('Aucun token fourni');
			return reply.code(200).send({
				valid: false,
				message: 'No token provided'
			});
		}

		const result = await authService.validateToken(accessToken, refreshToken, 'access', db);

		// Si la validation échoue, nettoyer les cookies et retourner valid: false
		if (!result) {
			fastify.log.info('Token invalide ou expiré');

			const isLocal = request.headers.host.startsWith("localhost");
			const cookieOptions = {
				path: '/',
				secure: !isLocal,
				httpOnly: true,
				sameSite: !isLocal ? 'None' : 'Lax'
			};

			// Nettoyer les cookies expirés
			return reply.code(200)
				.clearCookie('accessToken', cookieOptions)
				.clearCookie('refreshToken', cookieOptions)
				.send({
					valid: false, 
					message: 'Invalid or expired token'
				});
		}

		// Si un nouveau accessToken a été généré
		if (result.newAccessToken) {
			fastify.log.info('New access token generated, updating cookie');

			const isLocal = request.headers.host.startsWith("localhost");
			authUtils.setCookie(reply, result.newAccessToken, 15, isLocal); // accessToken : 15 min
		}

		// Récupérer l'utilisateur et retourner la réponse
		const user = db.prepare("SELECT username FROM users WHERE id = ?").get(result.userId);
		fastify.log.info('Token verified successfully for user:', user.username);
		return reply.send({
			valid: true,
			username: user.username
		});
	});
}

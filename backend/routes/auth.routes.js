const bcrypt = require("bcrypt");
const authService = require('../jwt/services/auth.service');

async function routes(fastify, options) {
	const { db } = fastify;

	// Route racine
	fastify.get("/", async (request, reply) => {
		return { status: "API is running" };
	});

	/*** 📌 Route: REGISTER ***/
	fastify.post("/register", async (request, reply) => {
		const { username, password } = request.body;

		fastify.log.info({ body: request.body }, "Tentative d'inscription");
		if (!username || !password) {
			fastify.log.warn("Échec d'inscription : username ou password manquant");
			return reply.code(400).send({ error: "Username and password are required" });
		}
		const userExists = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
		if (userExists) {
			fastify.log.warn(`Échec d'inscription : Username déjà pris (${username})`);
			return reply.code(400).send({ error: "Username already taken" });
		}

		// Hashage du mot de passe
		fastify.log.info(`Hashage du mot de passe pour l'utilisateur : ${username}`);
		const hashedPassword = await bcrypt.hash(password, 10);

		// Insertion dans la base de données
		const result = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run(username, hashedPassword);
		fastify.log.info(`Nouvel utilisateur enregistré : ${username}`);

		// Récupérer l'utilisateur nouvellement créé
		const newUser = db.prepare("SELECT id, username FROM users WHERE id = ?").get(result.lastInsertRowid);

		return reply.code(201).send({
			success: true,
			message: "User registered successfully",
			username: newUser.username,
			id: newUser.id
		});
	});

	/*** 📌 Route: UNREGISTER ***/
	fastify.post("/unregister", async (request, reply) => {
		const { username, password } = request.body;

		fastify.log.info({ username }, "Tentative de suppression de compte");

		try {
			// Vérification des champs requis
			if (!username || !password) {
				fastify.log.warn("Échec de suppression : champs manquants");
				return reply.code(400).send({ error: "Username and password are required" });
			}

			// Vérification de l'existence de l'utilisateur
			const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
			if (!user) {
				fastify.log.warn(`Utilisateur non trouvé : ${username}`);
				return reply.code(404).send({ error: "User not found" });
			}

			// Vérification du mot de passe
			const validPassword = await bcrypt.compare(password, user.password);
			if (!validPassword) {
				fastify.log.warn(`Mot de passe incorrect pour : ${username}`);
				return reply.code(401).send({ error: "Invalid password" });
			}

			// Utilisation d'une transaction pour la suppression atomique
			const transaction = db.transaction(async () => {
				fastify.log.info("Révocation des tokens de l'utilisateur");
				await authService.revokeTokens(user.id);

				fastify.log.info("Début de la suppression des données utilisateur");

				// 1. Rendre les parties anonymes plutôt que les supprimer
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

				// 2. Suppression du compte utilisateur
				db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
				fastify.log.debug(`Compte supprimé : ${username}`);
			});

			// Exécution de la transaction
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
				error: "Failed to delete user",
				details: error.message
			});
		}
	});

	/*** 📌 Route: IS USER ***/
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

	/*** 📌 Route: IS PASSWORD ***/
	fastify.post("/isPassword", async (request, reply) => {
		const { username, password } = request.body;
		fastify.log.debug(`Vérification du mot de passe pour l'utilisateur : ${username}`);

		const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);

		if (!user) {
			fastify.log.warn(`Échec de la vérification : utilisateur non trouvé (${username})`);
			return reply.code(404).send({ error: "User not found" });
		}

		const validPassword = await bcrypt.compare(password, user.password);

		if (validPassword) {
			fastify.log.info(`Mot de passe correct pour l'utilisateur : ${username}\n`);
		} else {
			fastify.log.warn(`Mot de passe incorrect pour l'utilisateur : ${username}\n`);
		}

		return reply.send({ valid: validPassword });
	});

	/*** 📌 Route: GET USER ID ***/
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
	fastify.post("/login", async (request, reply) => {
		const { username, password } = request.body;
		fastify.log.info({ username }, "Tentative de connexion");

		const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
		if (!user || !(await bcrypt.compare(password, user.password))) {
			fastify.log.warn(`Échec de connexion pour: ${username}`);
			return reply.code(401).send({ error: "Invalid credentials" });
		}

		const { accessToken, refreshToken } = await authService.generateTokens(user.id);


		const isLocal = request.headers.host.startsWith("localhost");

		reply
			.setCookie('accessToken', accessToken, {
				httpOnly: true,
				secure: !isLocal,
				sameSite: 'None',
				path: '/',
				maxAge: 15 * 60 // 15 minutes
			})
			.setCookie('refreshToken', refreshToken, {
				httpOnly: true,
				secure: !isLocal,
				sameSite: 'None',
				path: '/',
				maxAge: 7 * 24 * 60 * 60 // 7 jours
			})
			.send({
				success: true,
				message: "Login successful",
				username: user.username,
				id: user.id
			});
	});

	/*** 📌 Route: REFRESH TOKEN ***/
	fastify.post("/refresh", async (request, reply) => {
		const refreshToken = request.cookies.refreshToken;
		if (!refreshToken) {
			return reply.code(401).send({ error: "No refresh token provided" });
		}

		try {
			const newAccessToken = await authService.refreshAccessToken(refreshToken);
			if (!newAccessToken) {
				return reply.code(401).send({ error: "Invalid refresh token" });
			}

			// Utiliser le même format pour le refresh
			reply
				.headers({
					'Set-Cookie': [
						`accessToken=${newAccessToken}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${15 * 60}; Partitioned`
					]
				})
				.send({ success: true });

		} catch (error) {
			fastify.log.error(error);
			return reply.code(500).send({ error: "Failed to refresh token" });
		}
	});

	/*** 📌 Route: PROTECTED EXAMPLE ***/
	fastify.get("/protected", async (request, reply) => {
		// Le middleware auth vérifie déjà le token
		const userId = request.user.userId;
		const user = db.prepare("SELECT username FROM users WHERE id = ?").get(userId);

		return {
			message: "protected information",
			user: user.username
		};
	});

	/*** 📌 Route: ONLINE USERS (Protected) ***/
	fastify.get("/online-users", async (request, reply) => {
		// Le middleware auth vérifie déjà le token
		if (!request.user) {
			return reply.code(401).send({ error: "Unauthorized" });
		}

		const wsManager = fastify.wsManager;
		const onlineUsers = Array.from(wsManager.onlineUsers.entries())
			.map(([id, username]) => ({ id, username }));

		fastify.log.info({
			requestUser: request.user.userId,
			onlineCount: onlineUsers.length
		}, "Liste des utilisateurs en ligne envoyée");

		return { users: onlineUsers, count: onlineUsers.length };
	});

	/*** 📌 Route: LOGOUT ***/
	fastify.post("/logout", {
		schema: {
			body: { type: 'null' }
		}
	}, async (request, reply) => {
		// Le middleware a déjà vérifié le token et mis request.user
		const userId = request.user.userId;
		const token = request.cookies?.accessToken;

		fastify.log.info('Processing logout for user:', userId);

		try {
			// Révoquer les tokens
			await authService.revokeTokens(userId);
			await authService.blacklistToken(token);

			const isLocal = request.headers.host.startsWith("localhost");
			const cookieOptions = {
				path: '/',
				secure: !isLocal,
				httpOnly: true,
				sameSite: 'None'
			};

			fastify.log.info('Logout successful for user:', userId);

			return reply
				.clearCookie('accessToken', cookieOptions)
				.clearCookie('refreshToken', cookieOptions)
				.header('Access-Control-Allow-Credentials', 'true')
				.header('Access-Control-Allow-Origin', request.headers.origin || 'http://localhost:8080')
				.send({ success: true, message: "Logged out successfully" });

		} catch (error) {
			fastify.log.error('Logout error:', error);
			return reply.code(500).send({ error: 'Logout failed' });
		}
	});

	/*** 📌 Route: REVOKE TOKEN ***/
	fastify.post("/revoke", async (request, reply) => {
		const { userId } = request.body;

		if (!userId) {
			return reply.code(400).send({ error: "User ID is required" });
		}

		await authService.revokeTokens(userId);
		return { success: true, message: "Tokens revoked successfully" };
	});

	/*** 📌 Route: VERIFY TOKEN ***/
	fastify.post("/verify_token", {
		schema: {
			body: {
				type: ['object', 'null']
			}
		}
	}, async (request, reply) => {
		const accessToken = request.cookies?.accessToken;
		const refreshToken = request.cookies?.refreshToken;

		fastify.log.info('Verify Token Request:', {
			hasAccessToken: !!accessToken,
			hasRefreshToken: !!refreshToken,
			cookies: request.cookies
		});

		if (!accessToken && !refreshToken) {
			fastify.log.warn('Aucun token fourni');
			return reply.code(401).send({
				valid: false,
				error: 'No token provided',
				debug: { cookies: request.cookies }
			});
		}

		const result = await authService.validateToken(accessToken, refreshToken, 'access', db);

		if (!result) {
			fastify.log.warn('Invalid or expired token');

            const isLocal = request.headers.host.startsWith("localhost");
			const clientOrigin = request.headers.origin || 'http://localhost:8080';

			return reply
				.clearCookie('accessToken', {
					path: '/',
					secure: !isLocal,
					httpOnly: true,
					sameSite: !isLocal ? 'None' : 'Lax'
				})
				.clearCookie('refreshToken', {
					path: '/',
					secure: !isLocal,
					httpOnly: true,
					sameSite: !isLocal ? 'None' : 'Lax'
				})
				.header('Access-Control-Allow-Credentials', 'true')
				.header('Access-Control-Allow-Origin', clientOrigin)
				.code(401)
				.send({
					valid: false,
					error: 'Invalid or expired token',
					debug: { tokenProvided: true }
				});
		}

		// Si un nouveau accessToken a été généré
		if (result.newAccessToken) {
			request.log.info('New access token generated, updating cookie');

            const isLocal = request.headers.host.startsWith("localhost");
			reply.setCookie('accessToken', result.newAccessToken, {
				path: '/',
				secure: !isLocal,
				httpOnly: true,
				sameSite: !isLocal ? 'None' : 'Lax',
				maxAge: 60 * 15 // 15 minutes
			});
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

module.exports = routes;
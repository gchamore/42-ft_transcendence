import { google } from 'googleapis';
import authService from '../auth/auth.service.js';
import authUtils from '../auth/auth.utils.js';
import dotenv from 'dotenv';

dotenv.config();
const oauth2Client = new google.auth.OAuth2(
	process.env.GOOGLE_CLIENT_ID,
	process.env.GOOGLE_CLIENT_SECRET,
	process.env.GOOGLE_REDIRECT_URI
);

/*** 📌 Route: google/token ***/
// Trade the authorization code for tokens and user info
// This route is used to authenticate the user with Google OAuth
// and create or update the user in the database
// It also handles 2FA if enabled for the user
// It returns the access and refresh tokens in cookies
export async function oauthRoutes(fastify, options) {
	fastify.post('/auth/google', async (request, reply) => {
		try {
			const { code } = request.body;
			if (!code) {
				return reply.code(400).send({ success: false, error: 'Authorization code is required' });
			}

			// Trade the authorization code for tokens
			const { tokens } = await oauth2Client.getToken(code);
			oauth2Client.setCredentials(tokens);

			// Get user info from Google
			const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
			const { data } = await oauth2.userinfo.get();

			// Check if user exists in the database
			let user = fastify.db.prepare(
				"SELECT * FROM users WHERE email = ?"
			).get(data.email);

			// Send a temporary token to the frontend for username selection
			if (!user) {
				const tempPayload = {
					email: data.email,
					google_name: data.given_name,
					avatar: data.picture,
					is_google_account: true
				};

				const tempToken = await authService.generateTempToken(tempPayload, "google_oauth", 600);

				// Répondre au frontend pour qu'il affiche le formulaire de choix de username
				return reply.code(202).send({
					step: "choose_username",
					message: "Please choose a username to complete your Google account setup",
					temp_token: tempToken
				});
			}

			// Check if 2FA is enabled for the user
			if (user.twofa_secret) {
				try {
					const tempToken = await authService.generateTempToken({ userId: user.id }, "2fa", 300);
					fastify.log.info(`2FA token generated for Google OAuth user: ${user.username}`);

					return reply.code(202).send({
						step: "2fa_required",
						message: "2FA is enabled. Please provide the verification code.",
						temp_token: tempToken,
					});
				} catch (twoFaError) {
					fastify.log.error(twoFaError, `2FA token generation error in google Oauth:`);
					throw new Error('Failed to generate 2FA token in google Oauth');
				}
			}

			// If no 2FA, proceed with the normal process
			const { accessToken, refreshToken } = await authService.generateTokens(user.id);
			// Check if the application is running locally or in production
			const isLocal = request.headers.host.startsWith("localhost");

			// Set cookies with tokens
			authUtils.ft_setCookie(reply, accessToken, 15, isLocal);
			authUtils.ft_setCookie(reply, refreshToken, 7, isLocal);

			return reply.code(200).send({
				success: true,
				id: user.id,
				username: user.username,
				email: user.email,
				avatar: user.avatar,
			});

		} catch (error) {
			fastify.log.error('Google OAuth error:', error);
			return reply.code(500).send({ success: false, error: 'Internal server error while processing Google OAuth' });
		}
	});

	fastify.post("/auth/google/username", async (request, reply) => {
		const { username, temp_token } = request.body;

		try {
			//Verified token and get the payload from it
			const payload = await authService.verifyTempToken(temp_token, "google_oauth");

			// Check if the user already exists in the database
			const emailExists = fastify.db.prepare("SELECT 1 FROM users WHERE email = ?").get(payload.email);
			if (emailExists) {
				return reply.code(400).send({ success: false, error: "Account already created with this email" });
			}

			const checked_username = authUtils.checkUsername(fastify, username);
			if (typeof checked_username === 'object' && checked_username.error) {
				return reply.status(400).send({ success: false, error: checked_username.error });
			}
			const existingUser = fastify.db.prepare("SELECT 1 FROM users WHERE username = ?").get(checked_username);
			if (existingUser) {
				return reply.code(400).send({ success: false, error: "Username already taken" });
			}

			// Créer l'utilisateur en DB avec les infos du token
			const result = fastify.db.prepare(`
				INSERT INTO users (username, email, avatar, is_google_account, google_name)
				VALUES (?, ?, ?, 1, ?)
			`).run(checked_username, payload.email, payload.avatar, payload.google_name);

			const userId = result.lastInsertRowid;

			// Récupérer le user
			const user = fastify.db.prepare("SELECT * FROM users WHERE id = ?").get(userId);

			// Si 2FA activé (ce qui ne devrait pas être le cas pour un nouveau user normalement ?)
			if (user.twofa_secret) {
				try {
					const tempToken = await authService.generateTempToken({ userId: user.id }, "2fa", 300);
					fastify.log.info(`2FA token generated for Google OAuth user: ${user.username}`);

					return reply.code(202).send({
						step: "2fa_required",
						message: "2FA is enabled. Please provide the verification code.",
						temp_token: tempToken,
					});
				} catch (twoFaError) {
					fastify.log.error(twoFaError, `2FA token generation error in google Oauth:`);
					throw new Error('Failed to generate 2FA token in google Oauth');
				}
			}

			// Générer tokens JWT
			const { accessToken, refreshToken } = await authService.generateTokens(user.id);
			const isLocal = request.headers.host.startsWith("localhost");

			// Send the response with the tokens in cookies
			authUtils.ft_setCookie(reply, accessToken, 15, isLocal);
			authUtils.ft_setCookie(reply, refreshToken, 7, isLocal);

			return reply.code(201).send({
				success: true,
				id: user.id,
				username: user.username,
				email: user.email,
				avatar: user.avatar,
				message: "Google account created and user authenticated"
			});

		} catch (error) {
			fastify.log.error('Google OAuth complete-register error:', error);
			return reply.code(500).send({ success: false, error: 'Internal server error while completing Google account registration' });
		}
	});

	fastify.get('/auth/account_type', async (request, reply) => {
		try {
			const userId = request.user.userId;

			if (!userId) {
				return reply.code(401).send({ success: false, error: "Unauthorized" });
			}

			const user = fastify.db.prepare(`SELECT is_google_account, password FROM users WHERE id = ?`).get(userId);

			if (!user) {
				return reply.code(404).send({ success: false, error: "User not found" });
			}

			const isGoogle = !!user.is_google_account;
			const hasPassword = !!(user.password && user.password.trim().length > 0);

			return reply.code(200).send({
				success: true,
				message: "user account type retrieved",
				data: {
					is_google_account: isGoogle,
					has_password: hasPassword
				}
			});
		} catch (error) {
			fastify.log.error(error, `Error with user account type retrieved`);
			return reply.code(500).send({ success: false, error: "Internal server error while retrieving user account type" });
		}
	});


}


import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import bcrypt from 'bcrypt';
import redis from '../redis/redisClient.js';
import authService from '../auth/auth.service.js';
import authUtils from '../auth/auth.utils.js';


export async function twofaroutes(fastify, options) {
	const { db } = fastify;

	/*** 📌 Route: 2fa/setup ***/
	// Route to setup 2FA for the user
	// It generates a secret and a QR code for the user to scan
	// It returns the otpauth_url and the QR code data URL
	// The secret is stored temporarily until the user verifies it
	// The QR code is generated using the otpauth_url
	// The user must scan the QR code with their authenticator app
	// and enter the verification code to activate 2FA
	// The secret is stored in the database after verification
	// The QR code is displayed in the front-end for the user to scan
	fastify.post("/2fa/setup", async (request, reply) => {
		try {
			const userId = request.user.userId;
			// Check if the user exists in the database
			const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
			if (!user)
				return reply.code(404).send({ success: false, error: "User not found" });

			// Check if the user already has 2FA enabled
			if (user.twofa_secret) {
				return reply.code(400).send({ success: false, error: "2FA is already enabled for this user" });
			}

			// Prepare the secret for the user using speakeasy
			const secret = speakeasy.generateSecret({ name: `ft_transcendence:${user.username}` });

			// Generate the otpauth_url for the QR code
			const qrCode = await qrcode.toDataURL(secret.otpauth_url);

			// Store the secret temporarily in Redis with a 5-minute expiration
			await redis.setex(`2fa_setup_${userId}`, 300, secret.base32);

			// Stock le le secret dans la base de données
			return reply.code(200).send({
				otpauth_url: secret.otpauth_url,
				qrCode, // To be displayed in the front-end
				// secret: secret.base32
			});
		} catch (error) {
			fastify.log.error(error, `Error while setting up 2FA`);
			return reply.code(500).send({
				success: false,
				error: "Internal server error while setting up 2FA"
			});
		}
	});

	/*** 📌 Route: 2fa/activate ***/
	// Route to activate 2FA for the user
	// It verifies the token entered by the user with the secret
	// If the token is valid, it stores the secret in the database
	// If the token is invalid, it returns an error
	// The user must enter the verification code from their authenticator app
	fastify.post("/2fa/activate", async (request, reply) => {
		try {
			const userId = request.user.userId;
			const { token } = request.body;

			// token is the verification code entered by the user
			const secret = await redis.get(`2fa_setup_${userId}`);
			if (!secret)
				return reply.code(400).send({ success: false, error: "2FA setup expired" });

			// Check if the user exists in the database
			const isValid = speakeasy.totp.verify({ secret, encoding: 'base32', token });

			if (!isValid)
				return reply.code(400).send({ success: false, error: "Invalid verification code" });
			fastify.log.info(`[2FA] Secret validé et stocké : ${secret}`);

			// Finally store the secret in the database
			db.prepare("UPDATE users SET twofa_secret = ? WHERE id = ?").run(secret, userId);

			// Delete the secret from Redis
			await redis.del(`2fa_setup_${userId}`);

			return reply.code(200).send({ success: true, message: "2FA activated" });
		} catch (error) {
			fastify.log.error(error, `Error while activating 2FA`);
			return reply.code(500).send({
				success: false,
				error: "Internal server error while activating 2FA"
			});
		}
	});


	/*** 📌 Route: 2fa/verify ***/
	// Route to verify the 2FA token entered by the user
	// It verifies the token with the secret stored in the database
	// If the token is valid, it generates the access and refresh tokens
	// If the token is invalid, it returns an error
	// The user must enter the verification code from their authenticator app
	// The tokens are stored in cookies for authentication
	fastify.post("/2fa/verify", async (request, reply) => {
		try {

			const { token: twofaCode, temp_token } = request.body;

			// twofaCode is the verification code entered by the user
			// temp_token is the temporary token sent to the user

			// Vérifier le token temporaire
			const payload = await authService.verifyTempToken(temp_token, "2fa");
			const user = db.prepare("SELECT * FROM users WHERE id = ?").get(payload.userId);

			// Check if user has 2FA enabled
			if (!user?.twofa_secret) {
				return reply.code(400).send({ success: false, error: "2FA not configured for this user" });
			}

			// Verify the 2FA code with the secret stored in the database
			const isValid = speakeasy.totp.verify({
				secret: user.twofa_secret,
				encoding: 'base32',
				token: twofaCode
			});

			if (!isValid)
				return reply.code(400).send({ success: false, error: "Invalid 2FA code" });

			// Generate the access and refresh tokens
			const { accessToken, refreshToken } = await authService.generateTokens(user.id);
			const isLocal = request.headers.host.startsWith("localhost");

			authUtils.ft_setCookie(reply, accessToken, 15, isLocal);
			authUtils.ft_setCookie(reply, refreshToken, 7, isLocal);

			return reply.code(200).send({
				success: true,
				message: "2FA verification successful",
				username: user.username,
				id: user.id
			});
		} catch (error) {
			fastify.log.error(error, `Error while verifying 2FA`);
			return reply.code(500).send({
				success: false,
				error: "Internal server error while verifying 2FA"
			});
		}
	});

	/*** 📌 Route: 2fa/disable ***/
	// Route to disable 2FA for the user
	// It removes the secret from the database
	// The user can disable 2FA if they have access to their account
	// It does not require the verification code
	// The user must be authenticated to disable 2FA

	fastify.post("/2fa/disable", async (request, reply) => {
		try {

			const userId = request.user.userId;
			const { password } = request.body;

			// Récupérer l'utilisateur
			const user = db.prepare("SELECT password, username, is_google_account, twofa_secret FROM users WHERE id = ?").get(userId);

			if (!user) {
				fastify.log.warn(`[2FA] Désactivation échouée : utilisateur introuvable (ID: ${userId})`);
				return reply.code(404).send({ success: false, error: "User not found" });
			}

			if (!user.twofa_secret) {
				fastify.log.info(`[2FA] Tentative de désactivation ignorée : 2FA déjà désactivée pour ${user.username}`);
				return reply.code(400).send({ success: false, error: "2FA is not enabled for this user" });
			}


			// if user Google without password
			if (user.is_google_account && !user.password) {
				fastify.log.info(`[2FA] Utilisateur Google, désactivation sans mot de passe autorisée (${user.username})`);
			}

			// normal user or Google user with password
			else {
				// Check if the required fields are present
				if (!password) {
					fastify.log.warn("Password is required to disable 2FA");
					return reply.code(400).send({ success: false, error: "Password is required to disable 2FA" });
				}

				// Check if the password is correct
				const validPassword = await bcrypt.compare(password, user.password);
				if (!validPassword) {
					fastify.log.warn(`[2FA] Mauvais mot de passe lors de la désactivation pour ${user.username}`);
					return reply.code(401).send({ success: false, error: "Invalid password" });
				}
			}

			// Supprimer la 2FA
			db.prepare("UPDATE users SET twofa_secret = NULL WHERE id = ?").run(userId);
			fastify.log.info(`[2FA] Désactivation réussie pour ${user.username}`);

			return reply.code(200).send({ success: true, message: "2FA has been disabled" });
		} catch (error) {
			fastify.log.error(error, `Error while disabling 2FA`);
			return reply.code(500).send({
				success: false,
				error: "Internal server error while disabling 2FA"
			});
		}
	});


	/*** 📌 Route: 2fa/status ***/
	// Route to check the status of 2FA for the user
	// It returns whether 2FA is enabled or not
	// The user must be authenticated to check the status
	// It does not require the 2fa verification code
	fastify.get("/2fa/status", async (request, reply) => {
		try {

			const userId = request.user.userId;
			const user = db.prepare("SELECT twofa_secret FROM users WHERE id = ?").get(userId);

			if (!user) {
				return reply.code(404).send({ success: false, error: "User not found" });
			}

			return {
				enabled: !!user.twofa_secret
			};
		} catch (error) {
			fastify.log.error(error, `Error while checking 2FA status`);
			return reply.code(500).send({
				success: false,
				error: "Internal server error while checking 2FA status"
			});
		}
	});
}

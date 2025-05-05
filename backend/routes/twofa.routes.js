import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import authService from '../auth/auth.service.js';
import TwofaService from '../2fa/twofa.service.js';

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
		const userId = request.user.userId;
		const userId = request.user.userId;
		const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
		if (!user) return reply.code(404).send({ error: "User not found" });
	
		const secret = speakeasy.generateSecret({ name: `ft_transcendence:${user.username}` });
	
		const qrCode = await qrcode.toDataURL(secret.otpauth_url);
	
		// Stock le le secret dans la base de données
		return reply.send({
			otpauth_url: secret.otpauth_url,
			qrCode, // To be displayed in the front-end
			secret: secret.base32
		});
	});

	/*** 📌 Route: 2fa/activate ***/
	// Route to activate 2FA for the user
	// It verifies the token entered by the user with the secret
	// If the token is valid, it stores the secret in the database
	// If the token is invalid, it returns an error
	// The user must enter the verification code from their authenticator app
	fastify.post("/2fa/activate", async (request, reply) => {
		const { secret, token } = request.body;
		const userId = request.user.userId;
		const userId = request.user.userId;
	
		const isValid = speakeasy.totp.verify({
			secret,
			encoding: 'base32',
			token
		});
	
		if (!isValid) return reply.code(400).send({ error: "Invalid verification code" });
	
		// Finally store the secret in the database
		db.prepare("UPDATE users SET twofa_secret = ? WHERE id = ?").run(secret, userId);
	
		return reply.send({ success: true, message: "2FA activated" });
	});

	/*** 📌 Route: 2fa/verify ***/
	// Route to verify the 2FA token entered by the user
	// It verifies the token with the secret stored in the database
	// If the token is valid, it generates the access and refresh tokens
	// If the token is invalid, it returns an error
	// The user must enter the verification code from their authenticator app
	// The tokens are stored in cookies for authentication
	fastify.post("/2fa/verify", async (request, reply) => {
		const { token: twofaCode, temp_token } = request.body;

		// Vérifier le token temporaire
		const payload = await TwofaService.verifyTemp2FAToken(temp_token);
		const user = db.prepare("SELECT * FROM users WHERE id = ?").get(payload.userId);
	
		// Verify the 2FA code with the secret stored in the database
		const isValid = speakeasy.totp.verify({
			secret: user.twofa_secret,
			encoding: 'base32',
			token: twofaCode
		});
	
		if (!isValid) return reply.code(400).send({ error: "Invalid 2FA code" });
	
		// Generate the access and refresh tokens
		const { accessToken, refreshToken } = await authService.generateTokens(user.id);
		const isLocal = request.headers.host.startsWith("localhost");
	
		return reply
			.setCookie('accessToken', accessToken, {
				httpOnly: true,
				secure: !isLocal,
				sameSite: 'None',
				path: '/',
				maxAge: 15 * 60 // 15 min
			})
			.setCookie('refreshToken', refreshToken, {
				httpOnly: true,
				secure: !isLocal,
				sameSite: 'None',
				path: '/',
				maxAge: 7 * 24 * 60 * 60 // 7 days
			})
			.send({
				success: true,
				message: "2FA verification successful",
				username: user.username,
				id: user.id
			});
	});

	/*** 📌 Route: 2fa/disable ***/
	// Route to disable 2FA for the user
	// It removes the secret from the database
	// The user can disable 2FA if they have access to their account
	// It does not require the verification code
	// The user must be authenticated to disable 2FA
	fastify.post("/2fa/disable", async (request, reply) => {
		const userId = request.user.userId;
		const userId = request.user.userId;
		db.prepare("UPDATE users SET twofa_secret = NULL WHERE id = ?").run(userId);
		return reply.send({ success: true, message: "2FA disabled" });
	});

    /*** 📌 Route: 2fa/status ***/
	// Route to check the status of 2FA for the user
	// It returns whether 2FA is enabled or not
	// The user must be authenticated to check the status
	// It does not require the 2fa verification code
    fastify.get("/2fa/status", async (request, reply) => {
        const userId = request.user.userId;
        const user = db.prepare("SELECT twofa_secret FROM users WHERE id = ?").get(userId);
        
        if (!user) {
            return reply.code(404).send({ error: "User not found" });
        }

        return {
            enabled: !!user.twofa_secret
        };
    });
}

async function routes(fastify, options) {
    const { db } = fastify;

    /*** 📌 Route: 2FA ***/
	fastify.post("/2fa/setup", async (request, reply) => {
		const userId = request.user.id; // Récupère l'id du user depuis le JWT
		const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
		if (!user) return reply.code(404).send({ error: "User not found" });
	
		const secret = speakeasy.generateSecret({ name: `ft_transcendence:${user.username}` });
	
		const qrCode = await qrcode.toDataURL(secret.otpauth_url);
	
		// Stocker temporairement la secret ou attendre validation de l'utilisateur
		return reply.send({
			otpauth_url: secret.otpauth_url,
			qrCode, // à afficher dans le front
			secret: secret.base32
		});
	});
	
	fastify.post("/2fa/activate", async (request, reply) => {
		const { secret, token } = request.body;
		const userId = request.user.id;
	
		const isValid = speakeasy.totp.verify({
			secret,
			encoding: 'base32',
			token
		});
	
		if (!isValid) return reply.code(400).send({ error: "Invalid verification code" });
	
		// Stockage définitif de la clé 2FA
		db.prepare("UPDATE users SET twofa_secret = ? WHERE id = ?").run(secret, userId);
	
		return reply.send({ success: true, message: "2FA activated" });
	});
	
	fastify.post("/2fa/verify", async (request, reply) => {
		const { token: twofaCode, temp_token } = request.body;
		const payload = await authService.verifyTemp2FAToken(temp_token);
		const user = db.prepare("SELECT * FROM users WHERE id = ?").get(payload.userId);
	
		const isValid = speakeasy.totp.verify({
			secret: user.twofa_secret,
			encoding: 'base32',
			token: twofaCode
		});
	
		if (!isValid) return reply.code(400).send({ error: "Invalid 2FA code" });
	
		// Générer les vrais tokens après vérification réussie
		const { accessToken, refreshToken } = await authService.generateTokens(user.id);
		const isLocal = request.headers.host.startsWith("localhost");
	
		return reply
			.setCookie('accessToken', accessToken, { httpOnly: true, secure: !isLocal, sameSite: 'None', path: '/', maxAge: 15 * 60 })
			.setCookie('refreshToken', refreshToken, { httpOnly: true, secure: !isLocal, sameSite: 'None', path: '/', maxAge: 7 * 24 * 60 * 60 })
			.send({
				success: true,
				message: "2FA verification successful",
				username: user.username,
				id: user.id
			});
	});
	
	fastify.post("/2fa/disable", async (request, reply) => {
		const userId = request.user.id;
		db.prepare("UPDATE users SET twofa_secret = NULL WHERE id = ?").run(userId);
		return reply.send({ success: true, message: "2FA disabled" });
	});
}

module.exports = routes;

const jwt = require('jsonwebtoken');
const JWT_2FA_SECRET = process.env.JWT_2FA_SECRET || 'your-secret-key';

class TwofaService {
	async generateTemp2FAToken(userId) {
		return jwt.sign(
			{ userId, is2FATemp: true },
			JWT_2FA_SECRET,
			{ expiresIn: "5m" } // courte durée de vie
		);
	}
	
	async verifyTemp2FAToken(token) {
		try {
			const payload = jwt.verify(token, JWT_2FA_SECRET);
			if (!payload.is2FATemp) throw new Error("Invalid token type");
			return payload;
		} catch (e) {
			throw new Error("Invalid temp 2FA token");
		}
	}
}

module.exports = new TwofaService();

import jwt from 'jsonwebtoken';
const JWT_2FA_SECRET = process.env.JWT_2FA_SECRET || 'your-secret-key';

class TwofaService {
	// Generate a 2FA token for the user with the given userId and using the 2FA secret
	// This token is used to verify the 2FA code and is valid for 5 minutes
	async generateTemp2FAToken(userId) {
		return jwt.sign(
			{ userId, is2FATemp: true },
			JWT_2FA_SECRET,
			{ expiresIn: "5m" }
		);
	}
	// Verify the 2FA token and use the 2FA secret
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

export default new TwofaService();

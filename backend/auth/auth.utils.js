import jwt from 'jsonwebtoken';
const JWT_2FA_SECRET = process.env.JWT_2FA_SECRET || 'your-secret-key';

export class AuthUtils {
	// async generateTemp2FAToken(userId) {
	// }
}

export default new AuthUtils();

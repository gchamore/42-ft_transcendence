const Redis = require('ioredis');
const jwt = require('jsonwebtoken');

const redis = new Redis();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days

class AuthService {
    async generateTokens(userId) {
        const accessToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
        const refreshToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });

        await redis.setex(`access_${userId}`, ACCESS_TOKEN_EXPIRY, accessToken);
        await redis.setex(`refresh_${userId}`, REFRESH_TOKEN_EXPIRY, refreshToken);

        return { accessToken, refreshToken };
    }

    async validateToken(token, type = 'access') {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            const storedToken = await redis.get(`${type}_${decoded.userId}`);
            return storedToken === token ? decoded : null;
        } catch (error) {
            return null;
        }
    }

    async refreshAccessToken(refreshToken) {
        const decoded = await this.validateToken(refreshToken, 'refresh');
        if (!decoded) return null;
        
        const { accessToken } = await this.generateTokens(decoded.userId);
        return accessToken;
    }

    async revokeTokens(userId) {
        await redis.del(`access_${userId}`);
        await redis.del(`refresh_${userId}`);
    }
}

module.exports = new AuthService();

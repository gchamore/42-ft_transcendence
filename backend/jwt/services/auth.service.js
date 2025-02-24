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

        await redis.sadd(`access_tokens_${userId}`, accessToken);
        await redis.setex(`refresh_${userId}`, REFRESH_TOKEN_EXPIRY, refreshToken);

        return { accessToken, refreshToken };
    }

    async validateToken(token, type = 'access') {
        try {
            // Vérifier d'abord si le token est blacklisté
            const isBlacklisted = await redis.get(`blacklist_${token}`);
            if (isBlacklisted) {
                return null;
            }

            const decoded = jwt.verify(token, JWT_SECRET);
            const inSet = await redis.sismember(`access_tokens_${decoded.userId}`, token);

            return inSet ? decoded : null;
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
        // Récupérer et blacklister les tokens s’ils existent en Redis
        const accessToken = await redis.get(`access_${userId}`);
        if (accessToken) {
            await this.blacklistToken(accessToken);
        }
        const refreshToken = await redis.get(`refresh_${userId}`);
        if (refreshToken) {
            await this.blacklistToken(refreshToken);
        }

        const tokens = await redis.smembers(`access_tokens_${userId}`);
        for (const tk of tokens) {
            await this.blacklistToken(tk);
        }
        await redis.del(`access_tokens_${userId}`);
        await redis.del(`refresh_${userId}`);
        return true;
    }

    async blacklistToken(token) {
        const decoded = jwt.decode(token);
        if (decoded) {
            const ttl = Math.max(decoded.exp - Math.floor(Date.now() / 1000), 0);
            await redis.setex(`blacklist_${token}`, ttl || 60, 'true');
        }
    }
}

module.exports = new AuthService();

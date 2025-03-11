const Redis = require('ioredis');
const jwt = require('jsonwebtoken');

const redis = new Redis();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days

class AuthService {

    // Générer un token d'accès et un token de rafraîchissement
    async generateTokens(userId) {
        const accessToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
        const refreshToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });

        await redis.sadd(`access_tokens_${userId}`, accessToken);
        await redis.setex(`refresh_${userId}`, REFRESH_TOKEN_EXPIRY, refreshToken);

        return { accessToken, refreshToken };
    }

    // Valider un token
    async validateToken(token, type = 'access', db) {
        try {
            // Vérifier d'abord si le token est blacklisté
            const isBlacklisted = await redis.get(`blacklist_${token}`);
            if (isBlacklisted) {
                return null;
            }

            const decoded = jwt.verify(token, JWT_SECRET);
            const inSet = await redis.sismember(`access_tokens_${decoded.userId}`, token);

            if (!inSet) {
                return null;
            }

            // Vérifier si l'utilisateur existe toujours dans la base de données
            if (db) {
                const userExists = db.prepare("SELECT id FROM users WHERE id = ?").get(decoded.userId);
                if (!userExists) {
                    // L'utilisateur n'existe plus, on révoque ses tokens
                    await this.revokeTokens(decoded.userId);
                    return null;
                }
            }

            return decoded;
        } catch (error) {
            return null;
        }
    }

    // Rafraîchir le token d'accès
    async refreshAccessToken(refreshToken) {
        try {
            // Vérifier si le token de rafraîchissement est dans la blacklist
            const isBlacklisted = await redis.get(`blacklist_${refreshToken}`);
            if (isBlacklisted) {
                return null;
            }

            const decoded = jwt.verify(refreshToken, JWT_SECRET);
            const storedRefreshToken = await redis.get(`refresh_${decoded.userId}`);

            if (refreshToken !== storedRefreshToken) {
                return null;
            }

            // Générer un nouveau token d'accès
            const accessToken = jwt.sign({ userId: decoded.userId }, JWT_SECRET, { 
                expiresIn: ACCESS_TOKEN_EXPIRY 
            });

            // Enregistrer le nouveau token dans Redis
            await redis.sadd(`access_tokens_${decoded.userId}`, accessToken);

            return accessToken;
        } catch (error) {
            console.error('Refresh token error:', error);
            return null;
        }
    }

    // Révoquer les tokens d'un utilisateur
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

    // Blacklister un token
    async blacklistToken(token) {
        const decoded = jwt.decode(token);
        if (decoded) {
            const ttl = Math.max(decoded.exp - Math.floor(Date.now() / 1000), 0);
            await redis.setex(`blacklist_${token}`, ttl || 60, 'true');
        }
    }
}

module.exports = new AuthService();

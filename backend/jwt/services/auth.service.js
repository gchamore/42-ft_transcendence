import jwt from 'jsonwebtoken';
import redis from '../../redis/redisClient.js';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days

export class AuthService {
    async generateTokens(userId) {
        // Générer les nouveaux tokens
        const accessToken = jwt.sign({ userId, type: 'access' }, JWT_SECRET, { 
            expiresIn: ACCESS_TOKEN_EXPIRY 
        });
        const refreshToken = jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { 
            expiresIn: REFRESH_TOKEN_EXPIRY 
        });

        // Stocker dans Redis
        await Promise.all([
            redis.setex(`access_${userId}`, ACCESS_TOKEN_EXPIRY, accessToken),
            redis.setex(`refresh_${userId}`, REFRESH_TOKEN_EXPIRY, refreshToken)
        ]);

        return { accessToken, refreshToken };
    }

    async validateToken(accessToken, refreshToken, type = 'access', db) {
        try {
            // Vérifier si le token d'accès est blacklisté
            const isBlacklisted = await redis.get(`blacklist_${accessToken}`);
            if (isBlacklisted) return null;
    
            // Vérifier la validité du access token
            const decoded = jwt.verify(accessToken, JWT_SECRET);
            
            // Vérifier si l'utilisateur existe
            if (db) {
                const userExists = db.prepare("SELECT id FROM users WHERE id = ?").get(decoded.userId);
                if (!userExists) {
                    await this.revokeTokens(decoded.userId);
                    return null;
                }
            }
    
            // Vérifier si c'est bien le dernier access token valide
            const currentToken = await redis.get(`access_${decoded.userId}`);
            if (accessToken !== currentToken) return null;
    
            return { userId: decoded.userId };

        } catch (error) {
            console.warn('Access token invalide, tentative avec le refresh token.');
    
            // Essayer avec le refresh token
            if (!refreshToken) return null;
    
            try {
                // Générer un nouveau access token
                const newAccessToken = await this.refreshAccessToken(refreshToken);
                if (!newAccessToken) return null;

                const decoded = jwt.verify(newAccessToken, JWT_SECRET);
                return {
                    userId: decoded.userId,
                    newAccessToken
                };
            } catch (refreshError) {
                console.error('Échec de la vérification du refresh token.', refreshError);
                return null;
            }
        }
    }

    async refreshAccessToken(refreshToken) {
        try {
            const decoded = jwt.verify(refreshToken, JWT_SECRET);

            // Vérifier si le token est blacklisté
            const isBlacklisted = await redis.get(`blacklist_${refreshToken}`);
            if (isBlacklisted) return null;

            // Vérifier si c'est le refresh token actuel
            const storedRefreshToken = await redis.get(`refresh_${decoded.userId}`);
            if (refreshToken !== storedRefreshToken) return null;

            // Créer un nouveau token d'accès
            const newAccessToken = jwt.sign(
                { userId: decoded.userId, type: 'access' }, 
                JWT_SECRET, 
                { expiresIn: ACCESS_TOKEN_EXPIRY }
            );

            // Stocker le nouveau token
            await redis.setex(`access_${decoded.userId}`, ACCESS_TOKEN_EXPIRY, newAccessToken);

            return newAccessToken;
        } catch (error) {
            console.error('Refresh token error:', error);
            return null;
        }
    }

    async revokeTokens(userId) {
        try {
            // Récupérer les tokens actuels
            const [accessToken, refreshToken] = await Promise.all([
                redis.get(`access_${userId}`),
                redis.get(`refresh_${userId}`)
            ]);

            // Blacklister les tokens existants
            const blacklistPromises = [
                accessToken ? this.blacklistToken(accessToken) : null,
                refreshToken ? this.blacklistToken(refreshToken) : null
            ].filter(Boolean);

            // Supprimer les références Redis
            const cleanupPromises = [
                redis.del(`access_${userId}`),
                redis.del(`refresh_${userId}`)
            ];

            await Promise.all([...blacklistPromises, ...cleanupPromises]);
            return true;
        } catch (error) {
            console.error('Token revocation error:', error);
            return false;
        }
    }

    async blacklistToken(token) {
        try {
            const decoded = jwt.decode(token);
            if (!decoded) return false;

            // Calculer la durée restante du token
            const expiryTime = decoded.exp;
            const now = Math.floor(Date.now() / 1000);
            const timeRemaining = Math.max(expiryTime - now, 0);

            // Ajouter à la blacklist avec la durée restante exacte
            if (timeRemaining > 0) {
                await redis.setex(`blacklist_${token}`, timeRemaining, 'true');
                return true;
            }

            return false;
        } catch (error) {
            console.error('Token blacklisting error:', error);
            return false;
        }
    }
}

export default new AuthService();
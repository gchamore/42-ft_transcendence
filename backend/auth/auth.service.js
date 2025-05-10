import jwt from 'jsonwebtoken';
import redis from '../redis/redisClient.js';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_TEMP_SECRET = process.env.JWT_TEMP_SECRET || 'your-secret-key';

const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days
// const DEBUG_TOKEN_EXPIRY = 1 * 60; // 1 minute (for debug purposes)

export class AuthService {

	// Generate a new access token and refresh token for the user using the userId and JWT manager
	// The access token is valid for 15 minutes and the refresh token for 7 days
	// The tokens are stored in Redis with the userId as key
	// The access token is used to authenticate the user and the refresh token is used to generate a new access token
	async generateTokens(userId) {

		// Generate the access and refresh tokens using JWT
		const accessToken = jwt.sign({ userId, type: 'access' }, JWT_SECRET, {
			expiresIn: ACCESS_TOKEN_EXPIRY
		});
		const refreshToken = jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, {
			expiresIn: REFRESH_TOKEN_EXPIRY
		});

		await Promise.all([
			redis.setex(`access_${userId}`, ACCESS_TOKEN_EXPIRY, accessToken),
			redis.setex(`refresh_${userId}`, REFRESH_TOKEN_EXPIRY, refreshToken)
		]);

		return { accessToken, refreshToken };
	}

	async generateTempToken(payload, type = "generic", expiresInSeconds = 300) {
		const token = jwt.sign({ ...payload, type }, JWT_TEMP_SECRET, {
			expiresIn: expiresInSeconds
		});
	
		await redis.setex(`temp_${token}`, expiresInSeconds, 'valid');
	
		return token;
	}
	
	// Verify the 2FA token and use the 2FA secret
	async verifyTempToken(token, expectedType) {
		try {
			const isValid = await redis.get(`temp_${token}`);
			if (!isValid) {
				throw new Error("Temp token is expired or already used");
			}
	
			const payload = jwt.verify(token, JWT_TEMP_SECRET);
			if (payload.type !== expectedType) {
				throw new Error("Invalid token type");
			}
	
			// Delete the token from Redis after verification
			await redis.del(`temp_${token}`);
			return payload;
	
		} catch (e) {
			throw new Error("Invalid temp token");
		}
	}
	
	

	// Verify if the access token is valid (not blacklisted, user exists, in redis, not expired)
	// If the token is expired, it tries to refresh it using the refresh token
	// If both tokens are invalid, it clears the cookies and returns a 401 error
	async validate_and_refresh_Tokens(fastify, accessToken, refreshToken) {
		try {
			if (!accessToken) {
				fastify.log.warn('No access token provided');
				throw new Error('No access token provided');
			}
			fastify.log.info('ACCESS TOKEN CHECK...');

			// Check if the token is valid
			const decoded = jwt.verify(accessToken, JWT_SECRET);

			// Check if the token is blacklisted
			const isBlacklisted = await redis.get(`blacklist_${accessToken}`);
			if (isBlacklisted) {
				fastify.log.warn('Token is blacklisted');
				throw new Error('Token is blacklisted');
			}

			// Check if user exists in the database
			if (fastify.db) {
				const userExists = fastify.db.prepare("SELECT id FROM users WHERE id = ?").get(decoded.userId);

				if (!userExists) {
					fastify.log.warn('User not found in the database, revoking tokens...');
					await this.revokeTokens(decoded.userId);
					throw new Error('User not found in the database, tokens revoked');
				}
			}

			// Verify if the token is the latest
			const currentAccessToken = await redis.get(`access_${decoded.userId}`);
			if (accessToken !== currentAccessToken) {
				fastify.log.warn(`Token is not the latest one.`);
				throw new Error('Token is not the latest one.');
			}

			fastify.log.info('Access Token is valid\n');
			return {
				success: true,
				userId: decoded.userId
			};

		} catch (error) {
			fastify.log.warn('Access token invalid, Attempting to refresh it...');
			fastify.log.info('REFRESH TOKEN CHECK...');
			// If the access token is expired, try to refresh it using the refresh token
			if (!refreshToken) {
				fastify.log.error(error, 'No refresh token provided.');
				return { success: false, reason: 'No refresh token provided' };
			}

			try {
				const result = await this.refreshAccessToken(fastify, refreshToken, accessToken);
				if (!result.success) {
					fastify.log.warn(`Failed to refresh access token, invalid refresh token.`);
					return { success: false, reason: 'Failed to refresh access token, invalid refresh token.' };
				}
				fastify.log.info(`Nouveau access token généré avec succès.`);
				return {
					success: true,
					userId: result.userId,
					newAccessToken: result.newAccessToken,
				};
			} catch (refreshError) {
				fastify.log.error(refreshError, 'Fail to verify refresh token.');
				return { success: false, reason: 'Fail to verify refresh token.' };
			}
		}
	}


	// Refresh the access token using the refresh token
	// The refresh token is verified and if valid, a new access token is generated
	// The refresh token is also verified to ensure it's the current one
	// The new access token is stored in Redis with the userId as key
	// If the refresh token is invalid, it returns null
	async refreshAccessToken(fastify, refreshToken, oldAccessToken) {
		try {
			// Check if the token is valid
			const decoded = jwt.verify(refreshToken, JWT_SECRET);

			// Check if the token is blacklisted
			const isBlacklisted = await redis.get(`blacklist_${refreshToken}`);
			if (isBlacklisted) {
				fastify.log.warn('refreshToken is blacklisted');
				return { success: false, reason: 'refreshToken is blacklisted' };
			}

			// Check if user exists in the database
			if (fastify.db) {
				const userExists = fastify.db.prepare("SELECT id FROM users WHERE id = ?").get(decoded.userId);

				if (!userExists) {
					fastify.log.warn('User not found in the database, revoking tokens...');
					await this.revokeTokens(decoded.userId);
					return { success: false, reason: 'User not found in the database, tokens revoked' };
				}
			}

			// Check if it's the current refresh token
			const currentRefreshToken = await redis.get(`refresh_${decoded.userId}`);
			if (refreshToken !== currentRefreshToken) {
				fastify.log.warn(`Token is not the latest one.`);
				return { success: false, reason: 'Token is not the latest one.' };
			}

			// Blacklist the old access token (if provided)
			if (oldAccessToken) {
				blacklistToken(oldAccessToken);
				fastify.log.info('Old access token has been blacklisted.');
			}

			// Create a new access token
			const newAccessToken = jwt.sign(
				{ userId: decoded.userId, type: 'access' },
				JWT_SECRET,
				{ expiresIn: ACCESS_TOKEN_EXPIRY }
			);

			// Store the new token
			await redis.setex(`access_${decoded.userId}`, ACCESS_TOKEN_EXPIRY, newAccessToken);

			return {
				success: true,
				userId: decoded.userId,
				newAccessToken
			};
		} catch (error) {
			fastify.log.error(error, 'Fail to verify refresh token.');
			return { success: false, reason: 'Fail to verify refresh token.' };
		}
	}

	// Revoke tokens for a user by userId
	// This function retrieves the current access and refresh tokens from Redis
	// and blacklists them. It also removes the Redis references for both tokens.
	// The blacklisting process involves adding the tokens to a blacklist with their
	// remaining duration, ensuring they cannot be used again.
	// The Redis references are removed to clean up any stored tokens.
	// If the process is successful, it returns true; otherwise, it returns false.
	async revokeTokens(userId) {
		try {
			// Retrieve the current access and refresh tokens from Redis
			const [accessToken, refreshToken] = await Promise.all([
				redis.get(`access_${userId}`),
				redis.get(`refresh_${userId}`)
			]);

			// Blacklist the tokens
			const blacklistPromises = [
				accessToken ? this.blacklistToken(accessToken) : null,
				refreshToken ? this.blacklistToken(refreshToken) : null
			].filter(Boolean);

			// Delete the tokens from Redis
			const cleanupPromises = [
				redis.del(`access_${userId}`),
				redis.del(`refresh_${userId}`)
			];

			// Wait for all promises to resolve
			await Promise.all([...blacklistPromises, ...cleanupPromises]);
			return true;
		} catch (error) {
			fastify.log.error(error, 'Token revocation error:');
			return false;
		}
	}

	// Blacklist a token by adding it to the Redis blacklist with its remaining duration
	// The token is decoded to get its expiry time, and the remaining duration is calculated
	// The token is then added to the blacklist with the exact remaining duration
	// If the token is already expired, it returns false
	// If the token is successfully blacklisted, it returns true
	async blacklistToken(token) {
		try {
			// Get the decoded token to check its expiry time
			const decoded = jwt.decode(token);
			if (!decoded) return false;

			// Calculate the remaining duration of the token
			const expiryTime = decoded.exp;
			const now = Math.floor(Date.now() / 1000);
			const timeRemaining = Math.max(expiryTime - now, 0);

			// Add to the blacklist with the exact remaining duration
			if (timeRemaining > 0) {
				await redis.setex(`blacklist_${token}`, timeRemaining, 'true');
				return true;
			}

			return false;
		} catch (error) {
			fastify.log.error(error, 'Token blacklisting error:');
			return false;
		}
	}
}

export default new AuthService();

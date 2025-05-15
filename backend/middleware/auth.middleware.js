import authService from '../auth/auth.service.js';
import authUtils from '../auth/auth.utils.js';
import * as wsUtils from '../ws/ws.utils.js';
import jwt from 'jsonwebtoken';

// Middleware d'authentification for token checking
// It verifies if the access token is valid and not expired
// If the access token is expired, it tries to refresh it using the refresh token
// If both tokens are invalid, it clears the cookies and returns a 401 error
export async function authMiddleware(fastify, request, reply, done) {
    const accessToken = request.cookies?.accessToken;
    const refreshToken = request.cookies?.refreshToken;

	// Check Access and Refresh tokens if they are provided
	if (!accessToken && !refreshToken) {
		fastify.log.warn('No access and refresh token provided');
		return reply.code(401).send({ error: "No token provided" });
    }

	// Set cookie options :
	const cookieOptions = {
		path: '/',
		secure: true,
		httpOnly: true,
		sameSite: 'none'
	};

    try {
		// Check if the access token is valid otherwise try to refresh it
        const result = await authService.validate_and_refresh_Tokens(fastify, accessToken, refreshToken);
		if (!result.success) {
			// If the access token is invalid and the refresh token is also invalid
			request.log.warn('Invalid or expired token');
			// Try to decode the token to get the userId
			const decoded = jwt.decode(accessToken || refreshToken);
			const userId = decoded?.userId;
			
			if (userId) {
				const user = fastify.db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
				if (user) {
					await wsUtils.handleAllUserConnectionsClose(fastify, String(userId), user.username, 'Invalid token from middleware');
				}
			}
			
			// Clear the cookies and return a 401 error
            return reply
				.code(401)
                .clearCookie('accessToken', cookieOptions)
                .clearCookie('refreshToken', cookieOptions)
                .send({ error: 'Invalid token' });
        }
		// If the access token has been refreshed, update the cookie
        if (result.newAccessToken) {
            request.log.info('New access token generated, updating cookie');
            authUtils.ft_setCookie(reply, result.newAccessToken, 15);
        }
		// If the tokens are valid, set the userId in the request object
        request.user = {
            userId: result.userId
        };

        done();

    } catch (error) {
        request.log.error(error, 'Auth middleware error');
		reply.code(500).send({
				success: false,
				error: "Internal authentication error"
			});
    }
}
import authService from '../../auth/auth.service.js';
import authUtils from '../../auth/auth.utils.js';
import * as wsUtils from '../../ws/ws.utils.js';

// Middleware d'authentification for token checking
// It verifies if the access token is valid and not expired
// If the access token is expired, it tries to refresh it using the refresh token
// If both tokens are invalid, it clears the cookies and returns a 401 error
export async function authMiddleware(fastify, request, reply, done) {
    const accessToken = request.cookies?.accessToken;
    const refreshToken = request.cookies?.refreshToken;
	const isLocal = request.headers.host.startsWith("localhost"); // <- placé ici


    request.log.debug({
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        path: request.routeOptions?.url,
        cookies: request.cookies
    }, 'Auth middleware check');

    if (!accessToken && !refreshToken) {
        return reply.code(401).send({ 
            error: 'No token provided',
            path: request.routeOptions?.url
        });
    }

    try {
        const result = await authService.validateToken(fastify, accessToken, refreshToken, 'access');

		if (!result) {
			request.log.warn('Invalid or expired token');

			const decoded = jwt.decode(accessToken || refreshToken);
			const userId = decoded?.userId;

			if (userId) {
				const user = fastify.db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
				if (user) {
					await wsUtils.handleAllUserConnectionsClose(fastify, userId, user.username, 'Invalid token from middleware');
				}
			}

            const cookieOptions = {
                path: '/',
                secure: !isLocal,
                httpOnly: true,
                sameSite: !isLocal ? 'None' : 'Lax'
            };

            return reply
                .clearCookie('accessToken', cookieOptions)
                .clearCookie('refreshToken', cookieOptions)
                .code(401)
                .send({ error: 'Invalid token' });
        }

        if (result.newAccessToken) {
            request.log.info('New access token generated, updating cookie');
            authUtils.setCookie(reply, result.newAccessToken, 15, isLocal);
        }

        request.user = {
            userId: result.userId
        };

        done();

    } catch (error) {
        request.log.error(error, 'Auth middleware error');
        reply.code(500).send({ error: 'Internal authentication error' });
    }
}
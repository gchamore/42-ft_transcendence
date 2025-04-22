import authService from '../../auth/auth.service.js';

// Middleware d'authentification for token checking
// It verifies if the access token is valid and not expired
// If the access token is expired, it tries to refresh it using the refresh token
// If both tokens are invalid, it clears the cookies and returns a 401 error
export async function authMiddleware(request, reply, done) {
    const accessToken = request.cookies?.accessToken;
    const refreshToken = request.cookies?.refreshToken;
    
    request.log.debug({
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        path: request.routerPath,
        cookies: request.cookies
    }, 'Auth middleware check');

    if (!accessToken && !refreshToken) {
        return reply.code(401).send({ 
            error: 'No token provided',
            path: request.routerPath
        });
    }

    try {
        const result = await authService.validateToken(accessToken, refreshToken, 'access', request.server.db);

        if (!result) {
            request.log.warn('Invalid or expired token');

            const isLocal = request.headers.host.startsWith("localhost");
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

            const isLocal = request.headers.host.startsWith("localhost");
            reply.setCookie('accessToken', result.newAccessToken, {
                path: '/',
                secure: !isLocal,
                httpOnly: true,
                sameSite: !isLocal ? 'None' : 'Lax',
                maxAge: 60 * 15 // 15 minutes
            });
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
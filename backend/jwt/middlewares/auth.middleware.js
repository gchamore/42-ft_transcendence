const authService = require('../services/auth.service');

async function authMiddleware(request, reply, done) {
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

        // Si un nouveau accessToken a été généré
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

        // Stocker l'ID utilisateur dans la requête
        request.user = {
            userId: result.userId
        };

        done();

    } catch (error) {
        request.log.error(error, 'Auth middleware error');
        reply.code(500).send({ error: 'Internal authentication error' });
    }
}

module.exports = authMiddleware;

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
        // ✅ Vérification et renouvellement potentiel du accessToken
        const decoded = await authService.validateToken(accessToken, refreshToken, 'access', request.server.db);

        if (!decoded) {
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

        // ✅ Si un nouveau accessToken a été généré, mettre à jour le cookie
        if (decoded.newAccessToken) {
            request.log.info('New access token generated, updating cookie.');

            reply.setCookie('accessToken', decoded.newAccessToken, {
                path: '/',
                secure: !isLocal,
                httpOnly: true,
                sameSite: !isLocal ? 'None' : 'Lax',
                maxAge: 60 * 15 // Expire dans 15 minutes
            });
        }

        // ✅ Si le token est valide, stocker les infos utilisateur
        request.user = decoded;
        request.log.debug({
            userId: decoded.userId,
            path: request.routerPath
        }, 'Auth successful');

        done();
    } catch (error) {
        request.log.error(error, 'Auth middleware error');
        reply.code(500).send({ error: 'Internal authentication error' });
    }
}

module.exports = authMiddleware;

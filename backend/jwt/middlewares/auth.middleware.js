const authService = require('../services/auth.service');

async function authMiddleware(request, reply, done) {
    const token = request.cookies?.accessToken;
    
    // Log pour debug
    request.log.debug({
        hasToken: !!token,
        path: request.routerPath,
        cookies: request.cookies
    }, 'Auth middleware check');

    if (!token) {
        return reply.code(401).send({ 
            error: 'No token provided',
            path: request.routerPath
        });
    }

    try {
        // Utiliser la même méthode que verify_token
        const decoded = await authService.validateToken(token, 'access', request.server.db);
        
        if (!decoded) {
            const isLocal = request.headers.host.startsWith("localhost");
            const cookieOptions = {
                path: '/',
                secure: !isLocal,
                httpOnly: true,
                sameSite: 'None'
            };

            return reply
                .clearCookie('accessToken', cookieOptions)
                .clearCookie('refreshToken', cookieOptions)
                .code(401)
                .send({ error: 'Invalid token' });
        }

        // Si le token est valide, stocker les infos utilisateur
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


const authService = require('../services/auth.service');

async function authMiddleware(request, reply) {
    const token = request.cookies.accessToken;

    if (!token) {
        return reply.code(401).send({ error: 'No token provided' });
    }

    const decoded = await authService.validateToken(token, 'access', request.server.db);
    
    if (!decoded) {
        const isLocal = request.headers.host.startsWith("localhost");
        const cookieOptions = {
            path: '/',
            secure: !isLocal,
            httpOnly: true,
            sameSite: 'None'
        };

        // Utiliser les mêmes options que pour la création des cookies
        reply
            .clearCookie('accessToken', cookieOptions)
            .clearCookie('refreshToken', cookieOptions);
            
        return reply.code(401).send({ error: 'Invalid token' });
    }

    request.user = decoded;
}

module.exports = authMiddleware;


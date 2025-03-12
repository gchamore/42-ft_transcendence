const authService = require('../services/auth.service');

async function authMiddleware(request, reply) {
    const token = request.cookies.accessToken;

    if (!token) {
        return reply.code(401).send({ error: 'No token provided' });
    }

    const decoded = await authService.validateToken(token, 'access', request.server.db);
    
    if (!decoded) {
        // Supprimer les cookies si le token n'est pas valide
        reply
            .clearCookie('accessToken', {
                path: '/',
                secure: process.env.NODE_ENV === 'production',
                httpOnly: true,
                sameSite: 'strict'
            })
            .clearCookie('refreshToken', {
                path: '/',
                secure: process.env.NODE_ENV === 'production',
                httpOnly: true,
                sameSite: 'strict'
            });
            
        return reply.code(401).send({ error: 'Invalid token' });
    }

    request.user = decoded;
}

module.exports = authMiddleware;


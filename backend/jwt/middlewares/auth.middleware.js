const authService = require('../services/auth.service');

async function authMiddleware(request, reply) {
    const token = request.cookies.accessToken;

    if (!token) {
        return reply.code(401).send({ error: 'No token provided' });
    }

    const decoded = await authService.validateToken(token);
    
    if (!decoded) {
        return reply.code(401).send({ error: 'Invalid token' });
    }

    request.user = decoded;
}

module.exports = authMiddleware;


const authService = require('../services/auth.service');

async function authMiddleware(request, reply) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return reply.code(401).send({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = await authService.validateToken(token);
    
    if (!decoded) {
        return reply.code(401).send({ error: 'Invalid token' });
    }

    request.user = decoded;
}

module.exports = authMiddleware;

const fastify = require("fastify")({ 
    logger: {
        transport: {
            target: 'pino-pretty',
            options: { translateTime: 'HH:MM:ss Z' }
        }
    }
});

// Import des dépendances essentielles
const WebSocket = require('ws');
const WebSocketManager = require('./websocket/WebSocketManager');
const jwt = require('jsonwebtoken');
const initializeDatabase = require("./db/schema");

// ====== Initialisation des services ======
// WebSocket Manager
const wsManager = new WebSocketManager();
fastify.decorate('wsManager', wsManager);

// Base de données SQLite
try {
    const db = initializeDatabase(process.env.DATABASE_URL);
    fastify.decorate('db', db);
} catch (error) {
    console.error('Database initialization error:', error);
    process.exit(1);
}

// ====== Configuration CORS et Cookies ======
fastify.register(require('@fastify/cors'), {
    origin: true,
    credentials: true,
    methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Accept'],
    exposedHeaders: ['Set-Cookie'],
    preflight: true
});

fastify.register(require('@fastify/cookie'));

// ====== Middleware de gestion des requêtes ======
// Gestion CORS et OPTIONS
fastify.addHook('preHandler', (request, reply, done) => {
    reply.header('Access-Control-Allow-Origin', request.headers.origin || 'http://localhost:8080')
         .header('Access-Control-Allow-Credentials', 'true')
         .header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
         .header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie, Accept')
         .header('Access-Control-Expose-Headers', 'Set-Cookie');

    if (request.method === 'OPTIONS') {
        reply.code(204).send();
        return;
    }
    done();
});

// Configuration pour gérer les requêtes sans body
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
    if (body === '') {
        done(null, {});
        return;
    }
    try {
        const json = JSON.parse(body);
        done(null, json);
    } catch (err) {
        err.statusCode = 400;
        done(err, undefined);
    }
});

// Liste des routes publiques
const publicRoutes = ['/login', '/register', '/refresh', '/verify_token', '/ws'];

// Middleware d'authentification
fastify.addHook('onRequest', (request, reply, done) => {
    if (request.method === 'OPTIONS' || 
        publicRoutes.some(route => request.routerPath?.startsWith(route))) {
        return done();
    }
    require('./jwt/middlewares/auth.middleware')(request, reply);
});

// ====== Configuration WebSocket ======
fastify.register(require('@fastify/websocket'), {
    options: { maxPayload: 1048576 }
});

// Serveur WebSocket
const wss = new WebSocket.Server({ noServer: true });

// Gestion des connexions WebSocket
wss.on('connection', (ws, request, userId) => {
    wsManager.handleConnection({ socket: ws, userId }, userId);

    ws.on('message', message => {
        try {
            const data = JSON.parse(message);
            // Gérer les messages WebSocket ici
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    });

    ws.on('close', () => wsManager.handleDisconnection(userId));
});

// Gestion de l'authentification WebSocket
fastify.server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
        socket.destroy();
        return;
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        wss.handleUpgrade(request, socket, head, ws => {
            wss.emit('connection', ws, request, decoded.userId);
        });
    } catch (error) {
        socket.destroy();
    }
});

// ====== Routes ======
fastify.register(require('./routes/auth.routes'));
fastify.register(require('./routes/websocket.routes'));

// ====== Gestion de l'arrêt propre ======
const cleanup = async (signal) => {
    console.log(`\n${signal} received. Cleaning up...`);
    try {
        await fastify.close();
        fastify.db?.close();
        process.exit(0);
    } catch (error) {
        console.error('Cleanup error:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', () => cleanup('SIGTERM'));
process.on('SIGINT', () => cleanup('SIGINT'));

// ====== Démarrage du serveur ======
fastify.listen({ port: 3000, host: '0.0.0.0' }, (err) => {
    if (err) {
        console.error('Server start error:', err);
        process.exit(1);
    }
    console.log('🚀 Server ready at http://0.0.0.0:3000');
});

const fastify = require("fastify")({ 
    logger: {
        transport: {
            target: 'pino-pretty',
            options: { translateTime: 'HH:MM:ss Z' }
        }
    }
});

// Import des dépendances essentielles
const initializeDatabase = require("./db/schema");
const WebSocket = require('@fastify/websocket');

// ====== Initialisation des services ======
// Configurer WebSocket
fastify.register(WebSocket, {
    options: { 
        maxPayload: 1048576,
        clientTracking: true
    }
});

// Stocker les connexions WebSocket actives
fastify.decorate('connections', new Map());

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

// Liste des routes publiques
const publicRoutes = [
    '/login',
    '/register',
    '/refresh',
    '/verify_token',
	'/auth/google/token'
];

// Middleware d'authentification
fastify.addHook('onRequest', (request, reply, done) => {
    // Log pour debug
    fastify.log.debug({
        path: request.routerPath,
        method: request.method,
        isPublic: publicRoutes.some(route => request.routerPath?.startsWith(route))
    }, 'Route check');

    if (request.method === 'OPTIONS' || 
        publicRoutes.some(route => request.routerPath?.startsWith(route))) {
        return done();
    }

    // Si route protégée, on passe par le middleware d'auth
    require('./jwt/middlewares/auth.middleware')(request, reply, done);
});

// ====== Routes ======
fastify.register(require('./routes/auth.routes'));
fastify.register(require('./routes/game.routes'));
fastify.register(require('./routes/user.routes'));
fastify.register(require('./routes/ws.routes'));
fastify.register(require('./routes/oauth.routes'));

// ====== Gestion de l'arrêt propre ======
const cleanup = async (signal) => {
    console.log(`\n${signal} received. Cleaning up...`);
    try {
        // Fermer toutes les connexions WebSocket
        for (const [userId, ws] of fastify.connections) {
            ws.close();
        }
        fastify.connections.clear();
        
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
    console.log('🚀 Server ready at http://localhost:8080');
});
/* cote firefox : 
J'arrive bien sur la fenetre de connexion google oauth. avec ces messages :
Content-Security-Policy warnings 3
WARNING! m=_b,_tp:424:253
Using this console may allow attackers to impersonate you and steal your information using an attack called Self-XSS.
Do not enter or paste code that you do not understand. m=_b,_tp:424:253
Content-Security-Policy: Couldn’t process unknown directive ‘require-trusted-types-for’ bscframe
Content-Security-Policy warnings 2
This page is in Quirks Mode. Page layout may be impacted. For Standards Mode use “<!DOCTYPE html>”.
CheckConnection
unreachable code after return statement
identifier:158:22906
unreachable code after return statement
identifier:158:23985
unreachable code after return statement
identifier:158:50830
unreachable code after return statement
identifier:158:23985
unreachable code after return statement 
Sur chrome :
J'ai une erreur : {"error":"No token provided"}

Avec ces messages d'erreur console :
 
 GET http://localhost:8080/api/auth/google/callback?code=4%2F0AQSTgQHXmw_oL71QYa…A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile&authuser=0&prompt=none 401 (Unauthorized)
(anonymous)	@	:8080/:422
*/
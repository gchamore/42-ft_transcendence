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
const redis = require('./redis/redisClient');

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


function verifyCleanupSuccess(fastify, redis, db) {
    const handles = process._getActiveHandles();
    const requests = process._getActiveRequests();

    console.log('\n🔍 [CLEANUP] Vérification des ressources encore actives...');
    console.log(`🧵 Handles actifs (${handles.length}):`);
    handles.forEach((handle, i) => {
        const type = handle.constructor?.name || typeof handle;
        console.log(`  ${i + 1}. ${type}`);

        // 🎯 Connexions WebSocket
        if (type === 'Socket' && handle.remoteAddress) {
            console.log(`     ↪️  WebSocket vers ${handle.remoteAddress}:${handle.remotePort}`);
        }

        // 🎯 Connexions Redis (parfois détectées comme sockets ou timers)
        if (handle.constructor?.name === 'RedisClient') {
            console.log(`     ↪️  Redis client`);
        }
    });

    console.log(`📡 Requêtes en attente (${requests.length}):`);
    requests.forEach((req, i) => {
        const type = req.constructor?.name || typeof req;
        console.log(`  ${i + 1}. ${type}`);
    });

    // 📦 Vérifier fastify.connections
    if (fastify?.connections?.size > 0) {
        console.warn(`📡 [WS] ${fastify.connections.size} connexions WebSocket encore actives:`);
        for (const [userId, conn] of fastify.connections.entries()) {
            console.warn(`  🔗 User ${userId} - readyState: ${conn.readyState}`);
        }
    } else {
        console.log('✅ [WS] Toutes les connexions WebSocket ont été fermées');
    }

    // 🧠 Redis état
    if (redis?.status && redis.status !== 'end') {
        console.warn(`⚠️ [Redis] Connexion Redis encore active: status=${redis.status}`);
    } else {
        console.log('✅ [Redis] Connexion Redis fermée');
    }

    // 🗂️ SQLite
    try {
        if (db) {
            const stmt = db.prepare('SELECT 1');
            stmt.get(); // simple test
            console.warn('⚠️ [SQLite] La base semble encore accessible après cleanup');
        }
    } catch (err) {
        console.log('✅ [SQLite] Connexion SQLite probablement fermée');
    }

    if (handles.length === 0 && requests.length === 0 && fastify.connections.size === 0 && redis.status === 'end') {
        console.log('✅ [CLEANUP] Tout est correctement fermé 🎉');
    } else {
        console.warn('⚠️ [CLEANUP] Des ressources persistent, vérifie les logs ci-dessus');
    }
}



// ====== Gestion de l'arrêt propre ======
const wsUtils = require('./ws/ws.utils');

const cleanup = async (signal) => {
    console.log(`\n${signal} received. Cleaning up...`);

    try {
        // 🔄 Petite pause pour laisser le temps aux signaux en attente de se propager
        await new Promise(res => setTimeout(res, 200));

        // 🧹 Fermeture des WebSockets
        await wsUtils.closeAllWebSockets(fastify, 1001, "Server shutting down");

        // 🛑 Fermeture du serveur Fastify
        await fastify.close();

        // 🗂️ Fermeture SQLite
        if (fastify.db?.close) {
            fastify.db.close(); // SQLite est sync
        }

        // 🧠 Fermeture Redis
        if (redis && redis.status !== 'end') {
            await redis.quit();
        }

        // 🕵️ Vérification finale (après que tous les `.on('close')` aient pu se déclencher)
        setTimeout(() => {
            verifyCleanupSuccess(fastify, redis, fastify.db);
            // 💣 Quitter uniquement après avoir affiché les diagnostics
            setTimeout(() => {
                console.log('✅ [EXIT] Fermeture du process');
                process.exit(0);
            }, 250); // petit délai final
        }, 500); // donne 500ms aux sockets pour finir de se fermer

    } catch (error) {
        console.error('❌ Cleanup error:', error);
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
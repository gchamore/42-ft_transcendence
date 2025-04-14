const fastify = require("fastify")({ 
    logger: {
        transport: {
            target: 'pino-pretty',
            options: { translateTime: 'HH:MM:ss Z' }
        }
    }
});

// Import essential dependencies
const initializeDatabase = require("./db/schema");
const WebSocket = require('@fastify/websocket');
const redis = require('./redis/redisClient');

// ====== Initialization of services ======
// Configure WebSocket
fastify.register(WebSocket, {
    options: { 
        maxPayload: 1048576,
        clientTracking: true
    }
});

// Stock active WebSocket connections
fastify.decorate('connections', new Map());

// SQlite database
try {
    const db = initializeDatabase(process.env.DATABASE_URL);
    fastify.decorate('db', db);
} catch (error) {
    console.error('Database initialization error:', error);
    process.exit(1);
}

// ====== CORS and Cookies configuration ======
fastify.register(require('@fastify/cors'), {
    origin: true,
    credentials: true,
    methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Accept'],
    exposedHeaders: ['Set-Cookie'],
    preflight: true
});

fastify.register(require('@fastify/cookie'));

// List of public routes
const publicRoutes = [
    '/login',
    '/register',
    '/refresh',
    '/verify_token',
	'/auth/google/token',
	'/2fa/verify'
];

// Authentication middleware
fastify.addHook('onRequest', (request, reply, done) => {
    // Log for debug
    fastify.log.debug({
        path: request.routerPath,
        method: request.method,
        isPublic: publicRoutes.some(route => request.routerPath?.startsWith(route))
    }, 'Route check');

    if (request.method === 'OPTIONS' || 
        publicRoutes.some(route => request.routerPath?.startsWith(route))) {
        return done();
    }

	// If protected route, use auth middleware
    require('./jwt/middlewares/auth.middleware')(request, reply, done);
});

// ====== Routes ======
fastify.register(require('./routes/auth.routes'));
fastify.register(require('./routes/game.routes'));
fastify.register(require('./routes/user.routes'));
fastify.register(require('./routes/ws.routes'));
fastify.register(require('./routes/oauth.routes'));
fastify.register(require('./routes/twofa.routes'));

// ====== Graceful shutdown handling ======
const wsUtils = require('./ws/ws.utils');

const cleanup = async (signal) => {
	console.log(`\n${signal} received. Cleaning up...`);

	try {
		// Small pause to allow pending signals to propagate
		await new Promise(res => setTimeout(res, 200));

		// Close WebSockets
		await wsUtils.closeAllWebSockets(fastify, 1001, "Server shutting down");

		// Close Fastify server
		await fastify.close();

		// SQLite closing
        if (fastify.db?.close) {
            fastify.db.close();
        }
	
		// Redis closing
		if (redis && redis.status !== 'end') {
			await redis.quit();
		}


	} catch (error) {
		console.error('❌ Cleanup error:', error);
        process.exit(1);
    }
};


process.on('SIGTERM', () => cleanup('SIGTERM'));
process.on('SIGINT', () => cleanup('SIGINT'));

// ====== Server startup ======
fastify.listen({ port: 3000, host: '0.0.0.0' }, (err) => {
    if (err) {
        console.error('Server start error:', err);
        process.exit(1);
    }
    console.log('🚀 Server ready at http://localhost:8080');
});
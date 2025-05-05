import fastify from "fastify";
import { initializeDatabase } from "./db/schema.js";
import WebSocket from "@fastify/websocket";
import redis from "./redis/redisClient.js";
import * as wsUtils from "./ws/ws.utils.js";
import { authMiddleware } from "./jwt/middlewares/auth.middleware.js";
import { authRoutes } from "./routes/auth.routes.js";
import { gameRoutes } from "./routes/game.routes.js";
import { userRoutes } from "./routes/user.routes.js";
import { wsRoutes } from "./routes/ws.routes.js";
import { oauthRoutes } from "./routes/oauth.routes.js";
import { twofaroutes } from "./routes/twofa.routes.js";
import { cleanupAllGamesAndLobbies } from "./game/controllers/gameController.js";
import cookie from "@fastify/cookie";
import multipart from '@fastify/multipart';

const app = fastify({ 
    logger: {
        transport: {
            target: 'pino-pretty',
            options: { translateTime: 'HH:MM:ss Z' }
        }
    }
});

app.register(multipart, {
	attachFieldsToBody: 'auto',
	limits: {
		fileSize: 2 * 1024 * 1024 // 2MB
	}
});

// ====== Initialisation des services ======
// Configurer WebSocket
app.register(WebSocket, {
    options: { 
        maxPayload: 1048576,
        clientTracking: true
    }
});

// Stocker les connexions WebSocket actives
app.decorate('connections', new Map());

// Base de données SQLite
try {
    const db = initializeDatabase(process.env.DATABASE_URL);
    app .decorate('db', db);
} catch (error) {
    console.error('Database initialization error:', error);
    process.exit(1);
}

app.register(cookie);

// Liste des routes publiques
const publicRoutes = [
    '/login',
    '/register',
    '/refresh',
    '/verify_token',
	'/auth/google/token',
	'/2fa/verify',
	'/2fa/verify',
	'/ws'
];

// Middleware d'authentification
app.addHook('onRequest', (request, reply, done) => {
    // Log pour debug
    app.log.debug({
        path: request.routeOptions?.url,
        method: request.method,
        isPublic: publicRoutes.some(route => request.routeOptions?.url?.startsWith(route))
    }, 'Route check');

    if (request.method === 'OPTIONS' || 
        publicRoutes.some(route => request.routeOptions?.url?.startsWith(route))) {
        return done();
    }
	authMiddleware(request, reply, done);
});

app.register(authRoutes);
app.register(gameRoutes);
app.register(userRoutes);
app.register(wsRoutes);
app.register(oauthRoutes);
app.register(twofaroutes);


const cleanup = async (signal) => {
	console.log(`\n${signal} received. Cleaning up...`);

	try {
        // Nettoyage des games et des lobbies
        cleanupAllGamesAndLobbies();
        
		// Petite pause pour laisser le temps aux signaux en attente de se propager
		await new Promise(res => setTimeout(res, 200));


		// Fermeture des connexions WebSocket utilisateur par utilisateur
		for (const [userId] of app.connections.entries()) {
			const user = app.db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
			const username = user?.username || 'Unknown';
			await wsUtils.handleAllUserConnectionsClose(app, userId, username , 'Server shutting down');
		}

		// Vider Redis : supprime tous les utilisateurs en ligne
		const onlineUsers = await redis.smembers('online_users');
		if (onlineUsers.length > 0) {
			await redis.del('online_users');
			console.log(`🧹 Redis online_users list cleaned (${onlineUsers.length})`);
		}

		// Fermeture du serveur Fastify
		await app.close();

		// Fermeture SQLite
		if (app.db?.close) {
			app.db.close(); // SQLite est sync
		}

		// Fermeture Redis
		if (redis && redis.status !== 'end') {
			await redis.quit();
		}

		console.log("✅ Cleanup complete. Exiting now.");
		process.exit(0);

	} catch (error) {
		console.error('❌ Cleanup error:', error);
		process.exit(1);
	}
};


process.on('SIGTERM', () => cleanup('SIGTERM'));
process.on('SIGINT', () => cleanup('SIGINT'));

// ====== Démarrage du serveur ======
app.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
    if (err) {
        console.error('Server start error:', err);
        process.exit(1);
    }
    console.log(`🚀 Server ready at ${address}`);
});
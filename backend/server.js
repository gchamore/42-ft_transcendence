// 🚀 Import des dépendances
const fastify = require("fastify")({ 
    logger: {
        transport: {
            target: 'pino-pretty',
            options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
            }
        }
    }
});

const WebSocket = require('ws');
const WebSocketManager = require('./websocket/WebSocketManager');  // Garder seulement cette ligne
const jwt = require('jsonwebtoken');

const initializeDatabase = require("./db/schema");
const bcrypt = require("bcrypt");
const authMiddleware = require('./jwt/middlewares/auth.middleware');

// Initialiser le WebSocketManager
const webSocketManager = new WebSocketManager();
fastify.decorate('wsManager', webSocketManager);

// Couleurs pour les logs
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    cyan: "\x1b[36m"
};

// Logger personnalisé
const customLog = {
    success: (msg) => console.log(`${colors.bright}${colors.green}✓ ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.bright}${colors.red}✗ ${msg}${colors.reset}`),
    info: (msg) => console.log(`${colors.bright}${colors.cyan}ℹ ${msg}${colors.reset}`),
    warning: (msg) => console.log(`${colors.bright}${colors.yellow}⚠ ${msg}${colors.reset}`)
};

// Vérifier si les modules sont bien trouvés
try {
    customLog.info("Vérification des modules...");
    const db = initializeDatabase(process.env.DATABASE_URL);
    fastify.decorate('db', db);
    customLog.success("Base de données initialisée avec succès");
} catch (error) {
    customLog.error(`Erreur d'initialisation de la base de données: ${error.message}`);
    process.exit(1);
}

// Activer CORS pour permettre les requêtes depuis le frontend
fastify.register(require('@fastify/cors'), {
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Set-Cookie'],
});

// Enregistrer le plugin cookie
fastify.register(require('@fastify/cookie'));

// Ajouter WebSocket au serveur Fastify
fastify.register(require('@fastify/websocket'), {
    options: { maxPayload: 1048576 } // 1MB max payload
});

// Ajouter les routes WebSocket
fastify.register(require('./routes/websocket.routes'));

// Ajouter le middleware d'authentification aux routes protégées
fastify.addHook('preHandler', (request, reply, done) => {
    // Liste des routes qui ne nécessitent pas d'authentification
    const publicRoutes = [
        '/login',
        '/register',
        '/refresh',
        '/isUser',
        '/getUserId',
        '/getUserProfile',
        '/leaderboard',
        '/ws'
    ];

    // Vérifier si la route actuelle est publique
    if (request.routerPath && (
        publicRoutes.some(route => request.routerPath.startsWith(route)) ||
        request.routerPath === '/'
    )) {
        return done();
    }

    return authMiddleware(request, reply);
});

// Enregistrement des routes
fastify.register(require('./routes/auth.routes'));
fastify.register(require('./routes/game.routes'));

// Créer le serveur WebSocket
const wss = new WebSocket.Server({ noServer: true });

// Gérer les connexions WebSocket
wss.on('connection', async (ws, request, userId) => {
    customLog.info(`Nouvelle connexion WebSocket pour l'utilisateur ${userId}`);
    
    const connection = {
        socket: ws,
        userId: userId
    };

    wsManager.handleConnection(connection, userId);

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            customLog.info(`Message WebSocket reçu: ${JSON.stringify(data)}`);

            switch (data.type) {
                case 'JOIN_MATCHMAKING':
                    wsManager.addToMatchmaking(userId);
                    break;

                case 'LEAVE_MATCHMAKING':
                    wsManager.removeFromMatchmaking(userId);
                    break;

                case 'GAME_INVITE':
                    if (data.toUserId) {
                        wsManager.sendGameInvitation(userId, data.toUserId);
                    }
                    break;

                case 'GAME_MOVE':
                    if (data.gameId) {
                        wsManager.updateGameState(data.gameId, data.state);
                    }
                    break;

                default:
                    customLog.warning(`Type de message WebSocket non reconnu: ${data.type}`);
            }
        } catch (error) {
            customLog.error(`Erreur de traitement du message WebSocket: ${error.message}`);
        }
    });

    ws.on('close', () => {
        customLog.info(`Connexion WebSocket fermée pour l'utilisateur ${userId}`);
        wsManager.handleDisconnection(userId);
    });
});

// Ajouter la gestion de l'upgrade HTTP pour WebSocket
fastify.server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request, decoded.userId);
        });
    } catch (error) {
        customLog.error(`Erreur d'authentification WebSocket: ${error.message}`);
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
    }
});

// Gestion de l'arrêt propre
const clean_close = async (signal) => {
    customLog.warning(`Signal ${signal} reçu, arrêt propre en cours...`);
    
    try {
        await fastify.close();
        customLog.success("Serveur Fastify fermé");
        
        if (fastify.db) {
            fastify.db.close();
            customLog.success("Base de données fermée");
        }
        
        customLog.success("Arrêt propre terminé");
        process.exit(0);
    } catch (error) {
        customLog.error(`Erreur lors de l'arrêt: ${error.message}`);
        process.exit(1);
    }
};

process.on('SIGTERM', () => clean_close('SIGTERM'));
process.on('SIGINT', () => clean_close('SIGINT'));

// Démarrer le serveur avec logs améliorés
fastify.listen({
    port: 3000,
    host: '0.0.0.0'  // Écouter sur tous les ports
}, (err) => {
    if (err) {
        customLog.error(`Erreur de démarrage du serveur: ${err.message}`);
        process.exit(1);
    }
    
    customLog.info("Status du serveur:");
    customLog.success("- API REST disponible sur http://0.0.0.0:3000");
    customLog.success("- WebSocket disponible sur ws://0.0.0.0:3000/ws");
    customLog.success("- Base de données connectée");
    customLog.success("- CORS activé");
    console.log("\n" + colors.bright + colors.green + "🚀 Serveur prêt et opérationnel !" + colors.reset + "\n");
});

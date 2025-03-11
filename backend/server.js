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

const initializeDatabase = require("./db/schema");
const bcrypt = require("bcrypt");
const authMiddleware = require('./jwt/middlewares/auth.middleware');
const WebSocketManager = require('./websocket/WebSocketManager');

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
    origin: true, // permet toutes les origines en développement
    credentials: true
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
        '/verify_token',
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

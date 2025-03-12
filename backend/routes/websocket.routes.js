const authService = require('../jwt/services/auth.service');

/**
 * Routes WebSocket pour le monitoring des connexions utilisateurs
 */

async function routes(fastify, options) {
    // Récupérer l'instance WebSocketManager
    const wsManager = fastify.wsManager;
    
    // Route principale pour les WebSockets
    fastify.register(async function (fastify) {
        fastify.get('/ws', { websocket: true }, async (connection, req) => {
            // Connexion WebSocket établie
            fastify.log.info('Nouvelle connexion WebSocket établie');
            
            let userId = null;
            let username = null;
            let disconnectHandler = null;
            
            // Envoyer immédiatement la liste des utilisateurs en ligne
            setTimeout(async () => {
                try {
                    const onlineUsers = await wsManager.getOnlineUsers();
                    
                    connection.socket.send(JSON.stringify({
                        type: 'online_users_update',
                        users: onlineUsers
                    }));
                    
                    fastify.log.debug('Liste initiale des utilisateurs envoyée au nouveau client');
                } catch (error) {
                    fastify.log.error(error, 'Erreur lors de l\'envoi de la liste initiale des utilisateurs');
                }
            }, 100);
            
            connection.socket.on('message', async (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    fastify.log.debug({ data }, 'Message WebSocket reçu');
                    
                    // Gérer la connexion utilisateur
                    if (data.type === 'connection') {
                        // Récupérer le token depuis les cookies
                        const cookies = req.headers.cookie || '';
                        const accessTokenMatch = cookies.match(/accessToken=([^;]+)/);
                        const accessToken = accessTokenMatch ? accessTokenMatch[1] : null;
                        
                        if (accessToken) {
                            // Valider le token
                            const decoded = await authService.validateToken(accessToken, 'access', fastify.db);
                            if (decoded) {
                                userId = String(decoded.userId);
                                
                                // Récupérer le username depuis la base de données
                                const user = fastify.db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
                                if (user) {
                                    username = user.username;
                                    
                                    // Vérifier que les données envoyées correspondent
                                    if (data.userId && String(data.userId) !== userId) {
                                        fastify.log.warn(`Tentative de connexion avec un ID incorrect: ${data.userId} vs ${userId}`);
                                    }
                                    
                                    // Continuer avec l'utilisateur authentifié
                                    disconnectHandler = await wsManager.handleConnection(
                                        { socket: connection.socket },
                                        userId,
                                        username
                                    );
                                    
                                    fastify.log.info(`Utilisateur authentifié ${username} (${userId}) connecté via WebSocket`);
                                    
                                    // Confirmer la connexion au client
                                    connection.socket.send(JSON.stringify({
                                        type: 'connection_confirmed',
                                        userId: userId,
                                        username: username,
                                        authenticated: true
                                    }));
                                    
                                    return;
                                }
                            }
                        }
                        
                        // Si on arrive ici, soit pas de token, soit token invalide
                        // Accepter quand même la connexion mais avec statut non authentifié
                        userId = String(data.userId);
                        username = data.username;
                        
                        if (!userId || !username) {
                            connection.socket.send(JSON.stringify({
                                type: 'error',
                                message: 'Missing userId or username'
                            }));
                            return;
                        }
                        
                        // Stocker la connexion avec le WebSocketManager
                        disconnectHandler = await wsManager.handleConnection(
                            { socket: connection.socket },
                            userId,
                            username
                        );
                        
                        fastify.log.info(`Utilisateur non-authentifié ${username} (${userId}) connecté via WebSocket`);
                        
                        // Confirmer la connexion au client
                        connection.socket.send(JSON.stringify({
                            type: 'connection_confirmed',
                            userId: userId,
                            username: username,
                            authenticated: false
                        }));
                    }
                    // Gérer les pings
                    else if (data.type === 'ping') {
                        // Répondre avec un pong contenant le timestamp d'origine
                        connection.socket.send(JSON.stringify({
                            type: 'pong',
                            timestamp: data.timestamp,
                            userId: data.userId
                        }));
                        
                        fastify.log.debug(`Ping reçu de ${username || 'utilisateur inconnu'}`);
                    }
                } catch (error) {
                    fastify.log.error(error, 'Erreur lors du traitement du message WebSocket');
                }
            });
            
            // Gérer la fermeture de connexion
            connection.socket.on('close', () => {
                fastify.log.info(`Connexion WebSocket fermée${username ? ` pour ${username}` : ''}`);
                
                // Nettoyer avec le WebSocketManager
                if (disconnectHandler) {
                    disconnectHandler();
                }
            });
            
            // Gérer les erreurs de connexion
            connection.socket.on('error', (error) => {
                fastify.log.error(error, `Erreur WebSocket${username ? ` pour ${username}` : ''}`);
                
                if (disconnectHandler) {
                    disconnectHandler();
                }
            });
        });
    });
}

module.exports = routes;

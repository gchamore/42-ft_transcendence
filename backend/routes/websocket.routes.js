/**
 * Routes WebSocket pour le monitoring des connexions utilisateurs
 */

async function routes(fastify, options) {
    // Récupérer l'instance WebSocketManager
    const wsManager = fastify.wsManager;
    
    // Route principale pour les WebSockets
    fastify.register(async function (fastify) {
        fastify.get('/ws', { websocket: true }, (connection, req) => {
            // Connexion WebSocket établie
            fastify.log.info('Nouvelle connexion WebSocket établie');
            
            let userId = null;
            let username = null;
            let disconnectHandler = null;
            
            // Envoyer immédiatement la liste des utilisateurs en ligne
            setTimeout(() => {
                try {
                    const onlineUsers = Array.from(wsManager.onlineUsers.entries())
                        .map(([id, name]) => ({ id, username: name }));
                    
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
                        userId = String(data.userId);
                        username = data.username;
                        
                        // Stocker la connexion avec le WebSocketManager
                        disconnectHandler = wsManager.handleConnection(
                            { socket: connection.socket },
                            userId,
                            username
                        );
                        
                        fastify.log.info(`Utilisateur ${username} (${userId}) connecté via WebSocket`);
                        
                        // Confirmer la connexion au client
                        connection.socket.send(JSON.stringify({
                            type: 'connection_confirmed',
                            userId: userId,
                            username: username
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

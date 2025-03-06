/**
 * Routes WebSocket pour le monitoring des connexions utilisateurs
 */

async function routes(fastify, options) {
    // Route pour le monitoring des connexions
    fastify.get('/ws', { websocket: true }, (connection, req) => {
        let userId = null;
        let username = null;
        let disconnectHandler = null;
        
        // Gérer les messages reçus du client
        connection.socket.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                
                // Gestion de la connexion d'un utilisateur
                if (data.type === 'connection' && data.userId && data.username) {
                    userId = data.userId;
                    username = data.username;
                    
                    // Enregistrer la connexion
                    disconnectHandler = fastify.wsManager.handleConnection(
                        { socket: connection.socket },
                        userId,
                        username
                    );
                }
                // Répondre aux pings avec des pongs pour vérifier la connexion
                else if (data.type === 'ping') {
                    connection.socket.send(JSON.stringify({
                        type: 'pong',
                        timestamp: data.timestamp
                    }));
                }
                // Gestion d'autres types de messages WebSocket
                else if (data.type === 'matchmaking_join' && userId) {
                    fastify.wsManager.addToMatchmaking(userId);
                }
                else if (data.type === 'matchmaking_leave' && userId) {
                    fastify.wsManager.removeFromMatchmaking(userId);
                }
            } catch (err) {
                console.error('Error processing WebSocket message:', err);
            }
        });
        
        // Gérer la déconnexion
        connection.socket.on('close', () => {
            if (disconnectHandler) {
                disconnectHandler();
            }
        });
    });
    
    // Route API pour récupérer les utilisateurs en ligne (sans WebSocket)
    fastify.get('/online-users', async (request, reply) => {
        const onlineUsers = Array.from(fastify.wsManager.onlineUsers.entries())
            .map(([id, username]) => ({ id, username }));
        
        return { users: onlineUsers };
    });
}

module.exports = routes;

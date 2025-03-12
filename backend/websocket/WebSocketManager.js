const Redis = require('ioredis');

class WebSocketManager {
    constructor() {
        this.connections = new Map(); // userId -> connection
        this.games = new Map();       // gameId -> {player1, player2, ...gameState}
        this.matchmaking = new Set(); // Users looking for a game
        this.onlineUsers = new Map(); // userId -> username (in-memory cache)
        this.redis = new Redis();     // Redis client for persistence
    }

    async broadcastOnlineUsers() {
        const onlineUsersList = Array.from(this.onlineUsers.entries())
            .map(([id, username]) => ({ id, username }));

        const message = JSON.stringify({
            type: 'online_users_update',
            users: onlineUsersList
        });

        // Envoyer la mise à jour à tous les clients connectés
        for (const [userId, connection] of this.connections.entries()) {
            try {
                if (connection.socket.readyState === 1) { // OPEN
                    connection.socket.send(message);
                }
            } catch (error) {
                console.error(`Erreur d'envoi à l'utilisateur ${userId}:`, error);
                // En cas d'erreur, on déconnecte proprement l'utilisateur
                this.handleDisconnection(userId);
            }
        }
    }

    async handleConnection(connection, userId, username) {
        // Assurer que les ID sont toujours des chaînes pour la cohérence
        userId = String(userId);
        
        // Stocker la connexion et les informations utilisateur
        this.connections.set(userId, connection);
        this.onlineUsers.set(userId, username);
        
        // Stocker dans Redis
        await this.redis.sadd('online_users', userId);
        await this.redis.hset('user_names', userId, username);
        
        console.log(`User ${username} (ID: ${userId}) connected`);
        
        // Informer tous les utilisateurs de la nouvelle connexion
        this.broadcastOnlineUsers();
        
        // Envoyer la confirmation de connexion
        try {
            connection.socket.send(JSON.stringify({
                type: 'connection_confirmed',
                userId: userId,
                username: username
            }));
        } catch (error) {
            console.error('Erreur lors de la confirmation de connexion:', error);
        }
        
        // Retourner une fonction de nettoyage pour la déconnexion
        return () => this.handleDisconnection(userId);
    }

    async handleDisconnection(userId) {
        userId = String(userId);
        
        if (this.connections.has(userId)) {
            const username = this.onlineUsers.get(userId);
            console.log(`User ${username} (ID: ${userId}) disconnected`);
            
            // Nettoyer les références en mémoire
            this.connections.delete(userId);
            this.onlineUsers.delete(userId);
            this.matchmaking.delete(userId);
            
            // Nettoyer les références dans Redis
            await this.redis.srem('online_users', userId);
            
            // Informer les autres utilisateurs
            this.broadcastOnlineUsers();
        }
    }

    // Méthode pour gérer les pings
    handlePing(userId, timestamp) {
        const connection = this.connections.get(userId);
        if (connection && connection.socket.readyState === 1) {
            try {
                connection.socket.send(JSON.stringify({
                    type: 'pong',
                    timestamp: timestamp
                }));
            } catch (error) {
                console.error(`Erreur lors de l'envoi du pong à ${userId}:`, error);
            }
        }
    }

    // Méthode pour vérifier si un utilisateur est en ligne
    async isUserOnline(userId) {
        userId = String(userId);
        
        // Vérifier d'abord en mémoire (plus rapide)
        if (this.onlineUsers.has(userId)) {
            return true;
        }
        
        // Sinon vérifier dans Redis
        const isOnline = await this.redis.sismember('online_users', userId);
        return isOnline === 1;
    }

    // Obtenir la liste des utilisateurs en ligne
    async getOnlineUsers() {
        // Récupérer les IDs depuis Redis
        const userIds = await this.redis.smembers('online_users');
        
        // Récupérer les noms d'utilisateur pour chaque ID
        const users = [];
        for (const id of userIds) {
            const username = await this.redis.hget('user_names', id) || 'Unknown';
            users.push({ id, username });
        }
        
        return users;
    }
    
    // Synchroniser la mémoire avec Redis au démarrage
    async syncWithRedis() {
        // Nettoyer les données existantes
        await this.redis.del('online_users');
        
        // Réinitialiser avec les données en mémoire
        for (const [userId, username] of this.onlineUsers.entries()) {
            await this.redis.sadd('online_users', userId);
            await this.redis.hset('user_names', userId, username);
        }
    }
}

module.exports = WebSocketManager;
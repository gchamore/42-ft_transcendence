const Redis = require('ioredis');

class WebSocketManager {
    constructor() {
        this.connections = new Map(); // userId -> connection
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
        userId = String(userId);
    
        if (!this.connections.has(userId)) {
            this.connections.set(userId, []);
        }
        this.connections.get(userId).push(connection);
    
        this.onlineUsers.set(userId, username);
        await this.redis.sadd('online_users', userId);
        await this.redis.hset('user_names', userId, username);
    
        this.broadcastOnlineUsers();
    
        return () => this.handleDisconnection(userId, connection);
    }
    
    async handleDisconnection(userId, connection) {
        userId = String(userId);
    
        if (this.connections.has(userId)) {
            const userConnections = this.connections.get(userId);
            this.connections.set(userId, userConnections.filter(conn => conn !== connection));
    
            if (this.connections.get(userId).length === 0) {
                this.onlineUsers.delete(userId);
                await this.redis.srem('online_users', userId);
                this.broadcastOnlineUsers();
            }
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
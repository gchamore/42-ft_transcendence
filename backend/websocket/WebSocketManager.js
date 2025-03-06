class WebSocketManager{
    constructor() {
        this.connections = new Map(); // userId -> connection
        this.games = new Map();       // gameId -> {player1, player2, ...gameState}
        this.matchmaking = new Set(); // Users looking for a game
        this.onlineUsers = new Map(); // userId -> username
    }

    // Gestion des connexions
    handleConnection(connection, userId, username) {
        // Stocker la connexion
        this.connections.set(userId, connection);
        this.onlineUsers.set(userId, username);
        
        console.log(`User ${username} (ID: ${userId}) connected`);
        
        // Informer tous les utilisateurs de la nouvelle connexion
        this.broadcastOnlineUsers();
        
        return () => this.handleDisconnection(userId);
    }

    // Gestion des déconnexions
    handleDisconnection(userId) {
        if (this.connections.has(userId)) {
            const username = this.onlineUsers.get(userId);
            console.log(`User ${username} (ID: ${userId}) disconnected`);
            
            this.connections.delete(userId);
            this.onlineUsers.delete(userId);
            this.removeFromMatchmaking(userId);
            
            // Informer tous les utilisateurs de la déconnexion
            this.broadcastOnlineUsers();
        }
    }

    // Diffusion des utilisateurs en ligne
    broadcastOnlineUsers() {
        const onlineUsersList = Array.from(this.onlineUsers.entries()).map(([id, username]) => ({
            id, username
        }));
        
        this.broadcast({
            type: 'online_users_update',
            users: onlineUsersList
        });
    }

    // Gestion du matchmaking
    addToMatchmaking(userId) {
        this.matchmaking.add(userId);
        this.checkMatchmaking();
    }

    // Retirer un utilisateur du matchmaking
    removeFromMatchmaking(userId) {
        this.matchmaking.delete(userId);
    }

    // Vérifier si un utilisateur est en matchmaking
    checkMatchmaking() {
        if (this.matchmaking.size >= 2) {
            const players = Array.from(this.matchmaking).slice(0, 2);
            this.createGame(players[0], players[1]);
            this.matchmaking.delete(players[0]);
            this.matchmaking.delete(players[1]);
        }
    }

    // Gestion des parties
    createGame(player1Id, player2Id) {
        const gameId = Date.now().toString();
        this.games.set(gameId, {
            id: gameId,
            player1: player1Id,
            player2: player2Id,
            state: 'starting'
        });
        
        // Notifier les joueurs
        this.sendToUser(player1Id, {
            type: 'game_created',
            gameId: gameId,
            opponent: player2Id
        });
        
        this.sendToUser(player2Id, {
            type: 'game_created', 
            gameId: gameId,
            opponent: player1Id
        });
    }

    // Mettre à jour l'état d'une partie
    updateGameState(gameId, newState) {
        if (this.games.has(gameId)) {
            const game = this.games.get(gameId);
            this.games.set(gameId, { ...game, ...newState });
            this.broadcastToGame(gameId, {
                type: 'game_update',
                game: this.games.get(gameId)
            });
        }
    }

    // Gestion des invitations
    sendGameInvitation(fromUserId, toUserId) {
        if (this.connections.has(toUserId)) {
            this.sendToUser(toUserId, {
                type: 'game_invitation',
                from: fromUserId
            });
        }
    }

    // Méthodes d'envoi
    sendToUser(userId, message) {
        if (this.connections.has(userId)) {
            try {
                const connection = this.connections.get(userId);
                connection.socket.send(JSON.stringify(message));
            } catch (error) {
                console.error(`Failed to send message to user ${userId}:`, error);
            }
        }
    }

    // Envoyer un message à une partie
    broadcastToGame(gameId, message) {
        if (this.games.has(gameId)) {
            const game = this.games.get(gameId);
            this.sendToUser(game.player1, message);
            this.sendToUser(game.player2, message);
        }
    }

    // Envoyer un message à tous les utilisateurs
    broadcast(message) {
        this.connections.forEach((connection, userId) => {
            try {
                connection.socket.send(JSON.stringify(message));
            } catch (error) {
                console.error(`Failed to broadcast to user ${userId}:`, error);
                this.handleDisconnection(userId);
            }
        });
    }
}

module.exports = WebSocketManager;

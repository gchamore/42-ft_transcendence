class WebSocketManager{
    constructor() {
        this.connections = new Map(); // userId -> connection
        this.games = new Map();       // gameId -> {player1, player2, ...gameState}
        this.matchmaking = new Set(); // Users looking for a game
    }

    // Gestion des connexions
    handleConnection(connection, userId) {
        this.connections.set(userId, connection);
        this.broadcastOnlineUsers();
        
        connection.socket.on('close', () => {
            this.handleDisconnection(userId);
        });
    }

    handleDisconnection(userId) {
        this.connections.delete(userId);
        this.matchmaking.delete(userId);
        this.broadcastOnlineUsers();
    }

    // Diffusion des utilisateurs en ligne
    broadcastOnlineUsers() {
        const onlineUsers = Array.from(this.connections.keys());
        this.broadcast({
            type: 'ONLINE_USERS',
            users: onlineUsers
        });
    }

    // Gestion du matchmaking
    addToMatchmaking(userId) {
        this.matchmaking.add(userId);
        this.checkMatchmaking();
    }

    removeFromMatchmaking(userId) {
        this.matchmaking.delete(userId);
    }

    checkMatchmaking() {
        const players = Array.from(this.matchmaking);
        if (players.length >= 2) {
            const player1 = players[0];
            const player2 = players[1];
            this.createGame(player1, player2);
        }
    }

    // Gestion des parties
    createGame(player1Id, player2Id) {
        const gameId = Date.now();
        const gameState = {
            id: gameId,
            player1: player1Id,
            player2: player2Id,
            score1: 0,
            score2: 0,
            status: 'starting'
        };
        
        this.games.set(gameId, gameState);
        this.matchmaking.delete(player1Id);
        this.matchmaking.delete(player2Id);
        
        this.sendToUser(player1Id, {
            type: 'GAME_FOUND',
            game: gameState
        });
        this.sendToUser(player2Id, {
            type: 'GAME_FOUND',
            game: gameState
        });
    }

    updateGameState(gameId, newState) {
        const game = this.games.get(gameId);
        if (game) {
            Object.assign(game, newState);
            this.broadcastToGame(gameId, {
                type: 'GAME_UPDATE',
                game
            });
        }
    }

    // Gestion des invitations
    sendGameInvitation(fromUserId, toUserId) {
        this.sendToUser(toUserId, {
            type: 'GAME_INVITATION',
            from: fromUserId
        });
    }

    // Méthodes d'envoi
    sendToUser(userId, message) {
        const connection = this.connections.get(userId);
        if (connection) {
            connection.socket.send(JSON.stringify(message));
        }
    }

    broadcastToGame(gameId, message) {
        const game = this.games.get(gameId);
        if (game) {
            this.sendToUser(game.player1, message);
            this.sendToUser(game.player2, message);
        }
    }

    broadcast(message) {
        for (const connection of this.connections.values()) {
            connection.socket.send(JSON.stringify(message));
        }
    }
}

module.exports = WebSocketManager;
import { LobbyManager } from '../classes/lobbyManager.js';
import { GameInstance } from '../classes/gameInstance.js';
import { games } from '../controllers/gameController.js';

export function handleNewPlayer(socket, lobby) {
    // Verify socket is open
    if (socket.readyState !== WebSocket.OPEN) {
        console.error('Socket not in OPEN state');
        return;
    }

    if (!lobby.addPlayer(socket)) {
        console.error('Lobby is full');
        socket.close();
        return;
    }

    const playerNumber = socket.playerNumber;
    console.log(`Player ${playerNumber} joined lobby ${lobby.lobbyId}`);

    // Send welcome messages
    safeSend(socket, {
        type: 'playerNumber',
        playerNumber: playerNumber,
    });

    safeSend(socket, {
        type: 'connected',
        message: `Welcome Player ${playerNumber}!`,
        lobbyId: lobby.lobbyId,
    });

    // Player 1 sends settings to Player 2
    if (playerNumber === 2) {
        safeSend(socket, {
            type: 'settingsUpdate',
            settings: lobby.getSettings(),
        });
    }

    // Set up socket message handler
    socket.on('message', (message) => {
        const data = JSON.parse(message);
        handleLobbyMessage(socket, lobby, data);
    });

    // Handle disconnect
    socket.on('close', () => {
        console.log(`Player ${playerNumber} disconnected from lobby ${lobby.lobbyId}`);
        lobby.removePlayer(socket);
    });
}

function handleLobbyMessage(socket, lobby, data) {
    const playerNumber = socket.playerNumber;

    switch (data.type) {
        case 'updateSettings':
            if (playerNumber === 1) {
                lobby.updateSettings(data.settings);
            } else {
                safeSend(socket, {
                    type: 'error',
                    message: 'Only Player 1 can update settings',
                });
            }
            break;

        case 'playerReady':
            console.log(`Player ${playerNumber} is ready`);
            if (playerNumber === 2) {
                const player1 = lobby.players.find((player) => player.playerNumber === 1);
                if (player1) {
                    safeSend(player1, {
                        type: 'player2Ready',
                    });
                }
            }
            break;

        case 'startGameRequest':
            if (playerNumber === 1) {
                const gameId = data.gameId;
                console.log(`Starting game ${gameId} from lobby ${lobby.lobbyId}`);
                startGameFromLobby(lobby, gameId);
            }
            break;

        default:
            console.error(`Unknown message type: ${data.type}`);
    }
}

function startGameFromLobby(lobby, gameId) {
    const game = new GameInstance(gameId, lobby.getSettings());
    games.set(gameId, game);

    // Notify players about the game start
    lobby.players.forEach((player) => {
        safeSend(player, {
            type: 'gameStart',
            gameId: gameId,
            settings: lobby.getSettings(),
        });
    });

    // Clean up the lobby
    lobby.players = [];
}
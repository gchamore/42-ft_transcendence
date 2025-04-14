import { GameInstance } from '../classes/gameInstance.js';
import { games } from '../controllers/gameController.js';
import { safeSend } from '../utils/socketUtils.js';
import { removeMessageListeners } from './disconnectHandler.js';
import { handleNewGamePlayer } from './gameMessageHandlers.js';
import { lobbies } from '../controllers/gameController.js';
import WebSocket from 'ws';

export function handleNewLobbyPlayer(socket, lobby, clientId) {
	// Verify socket is open
	if (socket.readyState !== WebSocket.OPEN) {
		console.error('Socket not in OPEN state');
		return;
	}

	if (!lobby.addPlayer(socket, clientId)) {
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
		if (lobby.players.size === 0) {
			lobbies.delete(lobby.lobbyId);
			console.log(`Lobby ${lobby.lobbyId} deleted due to emptyness`);
		}
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
				const player1 = Array.from(lobby.players.values()).find((player) => player.playerNumber === 1);
				if (player1) {
					safeSend(player1, {
						type: 'player2Ready',
					});
				}
			}
			break;

		case 'startGameRequest':
			if (playerNumber === 1) {
				console.log(`Starting game from lobby ${lobby.lobbyId}`);
				startGameFromLobby(lobby);
			}
			break;

		default:
			console.error(`Unknown message type: ${data.type}`);
	}
}

function startGameFromLobby(lobby) {
	const gameId = 'game-' + lobby.lobbyId.split('-')[1];
	const game = new GameInstance(gameId, lobby.getSettings());
	console.log(`Transitioning game from Lobby ${lobby.lobbyId} to ${gameId}`);

	lobby.players.forEach((player) => {
		game.addPlayer(player);
	});

	game.transitionToGame(gameId);
	games.set(gameId, game);

	// Notify players about the game start
	lobby.players.forEach((player) => {
		safeSend(player, {
			type: 'gameStart',
			gameId: gameId,
			settings: lobby.getSettings(),
		});
		removeMessageListeners(player);

		handleNewGamePlayer(player, game);
	});

	// Clean up the lobby
	lobby.players.clear();
	lobbies.delete(lobby.lobbyId);
	console.log(`Game successfully transitioned  to ${gameId}`);
}
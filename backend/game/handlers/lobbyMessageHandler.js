import { GameInstance } from '../classes/gameInstance.js';
import { games } from '../controllers/gameController.js';
import { safeSend } from '../utils/socketUtils.js';
import { handleGameMessage, handleGameDisconnect } from './gameMessageHandlers.js';
import { handleNewGamePlayer } from './gameMessageHandlers.js';
import { lobbies, cleanupLobby } from '../controllers/gameController.js';
import WebSocket from 'ws';

export function handleNewLobbyPlayer(socket, lobby, clientId, playerNumber) {
	// Verify socket is open
	if (socket.readyState !== WebSocket.OPEN) {
		console.error('Socket not in OPEN state');
		return;
	}

	if (!lobby.addPlayer(socket, clientId, playerNumber)) {
		console.error('Lobby is full');
		socket.close();
		return;
	}

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
	if (playerNumber !== 1) {
		safeSend(socket, {
			type: 'settingsUpdate',
			settings: lobby.getSettings(),
		});
	}

	socket.currentHandler = (data) => handleLobbyMessage(socket, lobby, data);
	socket.currentCloseHandler = () => handleLobbyDisconnect(socket, lobby);

	// Set up socket message handler
	socket.on('message', (message) => {
		const data = JSON.parse(message);
		if (socket.currentHandler) {
			socket.currentHandler(data);
		} else {
			console.error('No handler set for incoming message');
		}
	});

	// Handle disconnect
	socket.on('close', () => {
		if (socket.currentCloseHandler) {
			socket.currentCloseHandler();
		} else {
			console.error('No close handler set for socket');
		}
	});
}

function handleLobbyDisconnect(socket, lobby) {
	
	console.log(`Player ${socket.playerNumber} disconnected from lobby ${lobby.lobbyId}`);
	lobby.removePlayer(socket);
	if (lobby.players.size === 0) {
		cleanupLobby(lobby.lobbyId);
		console.log(`Lobby ${lobby.lobbyId} deleted due to emptyness`);
	}
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
			if (playerNumber !== 1) {
				const player1 = Array.from(lobby.players.values()).find((player) => player.playerNumber === 1);
				if (player1) {
					safeSend(player1, {
						type: 'playerReady',
						playerNumber: playerNumber,
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
	const gameId = lobby.lobbyId;
	const settings = lobby.getSettings();
	const game = new GameInstance(gameId, settings);
	console.log(`Transitioning game from Lobby ${lobby.lobbyId} to ${gameId}`);

	games.set(gameId, game);

	// Notify players about the game start
	lobby.players.forEach((player) => {
		safeSend(player, {
			type: 'gameStart',
			gameId: gameId,
			settings: settings,
		});
		player.currentHandler = (data) => handleGameMessage(player, game, data);
		player.currentCloseHandler = () => handleGameDisconnect(player, game);
		handleNewGamePlayer(player, game);
	});

	// Clean up the lobby
	lobby.players.clear();
	lobbies.delete(lobby.lobbyId);
	console.log(`Game successfully transitioned  to ${gameId}`);
}
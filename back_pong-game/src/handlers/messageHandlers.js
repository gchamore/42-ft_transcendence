import WebSocket from 'ws';
import { games, mainLobby, broadcastGameState } from '../controllers/gameController.js';
import { safeSend } from '../utils/socketUtils.js';
import { handleDisconnect } from './disconnectHandler.js';

export const broadcastTimeout = {};

export function handleNewPlayer(socket, game) {
	// Verify socket is open
	if (socket.readyState !== WebSocket.OPEN) {
		console.error('Socket not in OPEN state');
		return;
	}

	if (!game.addPlayer(socket)) {
		console.error('Game is full');
		socket.close();
		return;
	}

	// Attach game instance to socket
	socket.gameInstance = game;
	const playerNumber = socket.playerNumber;

	console.log(`Player ${playerNumber} joined game ${game.gameId}`);

	// Send welcome messages
	safeSend(socket, {
		type: 'playerNumber',
		playerNumber: playerNumber
	});

	safeSend(socket, {
		type: 'connected',
		message: `Welcome Player ${playerNumber}!`,
		gameId: game.gameId
	});

	// Set up socket message handler
	socket.on('message', message => {
		const data = JSON.parse(message);
		handleGameMessage(socket, game, data);
	});

	// Set up disconnect handler
	socket.isDisconnecting = false;
	socket.on('close', () => {
		if (!socket || socket.isDisconnecting) return;
		socket.isDisconnecting = true;

		const playerNum = socket.playerNumber;
		const gameInst = socket.gameInstance;
		console.log(`Player ${playerNum} disconnected`);

		if (gameInst) {
			setTimeout(() => {
				handleDisconnect(socket, gameInst);
			}, 0);
		} else {
			console.error('Game instance not found for player disconnect');
		}
	});
}

export function handleGameMessage(socket, game, data) {
	const playerNumber = socket.playerNumber;
	const handlerResult = { shouldBroadcast: true };

	switch (data.type) {
		case 'playerReady':
			handlePlayerReady(socket, game, playerNumber);
			break;
		case 'startGameRequest':
			handleStartGameRequest(socket, game, playerNumber, data);
			break;
		case 'startGame':
			handleStartGame(socket, game, playerNumber);
			break;
		case 'movePaddle':
			const moveResult = handleMovePaddle(socket, game, playerNumber, data);
			handlerResult.shouldBroadcast = moveResult.shouldBroadcast;
			break;
		case 'updateSettings':
			handleUpdateSettings(socket, game, playerNumber, data);
			break;
		case 'rematchRequest':
			handleRematchRequest(socket, game, playerNumber);
			break;
	}

	if (handlerResult.shouldBroadcast) {
		broadcastGameState(game);
	}
}

// Individual message handlers
function handlePlayerReady(socket, game, playerNumber) {
	game.setPlayerReady(playerNumber);
	console.log(`Player ${playerNumber} ready. Total ready: ${game.playerReadyStatus.size}`);
	if (playerNumber === 2) {
		const player1 = game.players.find(player => player.playerNumber === 1);
		if (player1) {
			safeSend(player1, {
				type: 'player2Ready'
			});
		}
	}
}

function handleStartGameRequest(socket, game, playerNumber, data) {
	if (playerNumber === 1 && game.isLobby) {
		if (game.isGameReady()) {
			const newGameId = data.gameId;
			console.log(`Creating new game: ${newGameId} from lobby ${game.gameId}`);

			games.delete(game.gameId);
			game.transitionToGame(newGameId);
			games.set(newGameId, game);
			console.log(`New game has ${game.players.length} players and Id ${game.gameId}`);
			game.players.forEach((player) => {
				safeSend(player, {
					type: 'gameStart',
					gameId: newGameId,
					settings: game.settings
				});
				safeSend(player, {
					type: 'gameState',
					gameState: game.getState()
				});
			});
		} else {
			safeSend(socket, {
				type: 'error',
				message: 'Cannot start game until all players are ready'
			});
		}
	}
}

function handleStartGame(socket, game, playerNumber) {
	console.log(`Player ${playerNumber} trying to start game ${game.gameId}`);
	console.log('Available game IDs:', Array.from(games.keys()));
	if (playerNumber === game.gameState.servingPlayer) {
		if (game.players.length === 2) {
			const currentGame = games.get(game.gameId);
			currentGame.gameState.gameStarted = true;
		} else {
			safeSend(socket, {
				type: 'error',
				message: 'Waiting for another player to join'
			});
			return;
		}
	} else {
		safeSend(socket, {
			type: 'error',
			message: 'Only the serving player can start the round'
		});
		return;
	}
}

function handleMovePaddle(socket, game, playerNumber, data) {
	if (data.player !== playerNumber) {
		safeSend(socket, {
			type: 'error',
			message: 'Player trying to move paddle that is not theirs'
		});
		console.error('Player trying to move paddle that is not theirs');
		return;
	}
	validateAndUpdatePaddlePosition(socket, game, playerNumber, data);
	if (game.gameState.gameStarted) {
		const now = Date.now();
		if (!broadcastTimeout[game.gameId]) broadcastTimeout[game.gameId] = 0;

		if (game.paddleMoved && now - broadcastTimeout[game.gameId] > 33) { // 30 updates per second max
			broadcastGameState(game);
			game.paddleMoved = false;
			broadcastTimeout[game.gameId] = now;
		}
		return { shouldBroadcast: false };
	}
	return { shouldBroadcast: true };
}

function validateAndUpdatePaddlePosition(socket, game, playerNumber, data) {
	const previousPosition = game.gameState[`paddle${playerNumber}`].y;
	const newPosition = data.y;
	const maxMove = game.gameState[`paddle${playerNumber}`].speed * 4;

	if (Math.abs(newPosition - previousPosition) <= maxMove) {
		game.updatePaddlePosition(data.player, data.y);
		return;
	}

	console.log(`Suspicious paddle movement detected: Player ${playerNumber} moved ${Math.abs(newPosition - previousPosition)}px (${previousPosition} to ${newPosition})`);

	const absoluteMaxMove = maxMove * 2;
	if (Math.abs(newPosition - previousPosition) > absoluteMaxMove) {
		// Reject if beyond reasonable tolerance
		safeSend(socket, {
			type: 'syncPaddle',
			position: previousPosition,
			message: 'Movement rejected - too large'
		});
		game.updatePaddlePosition(data.player, previousPosition);
	} else {
		// Accept with larger tolerance
		game.updatePaddlePosition(data.player, data.y);
	}
}

function handleUpdateSettings(socket, game, playerNumber, data) {
	if (playerNumber === 1) {
		game.updateSettings(data.settings);
		game.players.forEach((player) => {
			safeSend(player, {
				type: 'settingsUpdate', //server to client
				settings: data.settings
			});
		});
	}
	else {
		safeSend(socket, {
			type: 'error',
			message: 'Only player 1 can update settings'
		});
	}
}

function handleRematchRequest(socket, game, playerNumber) {
	const otherPlayer = game.players.find(player => player.playerNumber !== playerNumber);

	if (!game.rematchRequested) {
		game.rematchRequested = playerNumber;
		if (otherPlayer) {
			safeSend(otherPlayer, {
				type: 'rematchRequested',
				player: playerNumber
			});
		}
		return;
	}

	if (game.rematchRequested && game.rematchRequested !== playerNumber) {
		game.resetForRematch();
		game.players.forEach((player) => {
			safeSend(player, {
				type: 'rematch'
			});
		});
		game.rematchRequested = null;
	}
}
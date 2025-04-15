import WebSocket from 'ws';
import { safeSend } from '../utils/socketUtils.js';
import { handleDisconnect } from './disconnectHandler.js';


export function handleNewGamePlayer(socket, game) {
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

	if (playerNumber === 2 && game.isLobby) {
		safeSend(socket, {
			type: 'settingsUpdate',
			settings: game.settings
		});
	}

	// Set up socket message handler
	socket.on('message', message => {
		const data = JSON.parse(message);
		if (socket.currentHandler) {
			socket.currentHandler(data);
		} else {
			console.error('No handler set for incoming message');
		}
	});

	// Set up disconnect handler
	socket.isDisconnecting = false;
	socket.on('close', () => {
		if (socket.currentCloseHandler) {
			socket.currentCloseHandler(socket, game);
		} else {
			console.error('No close handler set for socket');
		}
	});
}

export function handleGameDisconnect(socket, game) {
	if (!socket || socket.isDisconnecting) return;
	socket.isDisconnecting = true;

	const playerNum = socket.playerNumber;
	const gameInst = socket.gameInstance;
	console.log(`Player ${playerNum} disconnected`);

	if (gameInst) {
		handleDisconnect(socket, gameInst);
	} else {
		console.error('Game instance not found for player disconnect');
	}
}

export function handleGameMessage(socket, game, data) {
	const playerNumber = socket.playerNumber;
	switch (data.type) {
		case 'startGame':
			handleStartGame(socket, game, playerNumber);
			break;
		case 'movePaddle':
			handleMovePaddle(socket, game, playerNumber, data);
			break;
		case 'rematchRequest':
			handleRematchRequest(socket, game, playerNumber);
			break;
		case 'pong':
			socket.isAlive = true;
			break;
		default:
			console.error(`Unknown message type: ${data.type}`);
	}
}

function handleStartGame(socket, game, playerNumber) {
	if (playerNumber === game.gameState.servingPlayer) {
		if (game.players.length === 2) {
			console.log(`Player ${playerNumber} starting game ${game.gameId}`);
			game.gameState.gameStarted = true;
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
	if (data.playerNumber !== playerNumber) {
		safeSend(socket, {
			type: 'error',
			message: 'Player trying to move paddle that is not theirs'
		});
		console.error('Player trying to move paddle that is not theirs');
		return;
	}

	const paddle = game.gameState[`paddle${playerNumber}`];
	// validate input sequence
	if (data.inputSequence <= paddle.lastProcessedInput) {
		return;
	}

	paddle.y = data.paddlePosition;
	paddle.lastProcessedInput = data.inputSequence;
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
import { games, broadcastGameState } from '../controllers/gameController.js';
import { safeSend } from '../utils/socketUtils.js';

export function handleDisconnect(socket, game) {
	if (!validateDisconnectParams(socket, game)) return;

	const playerNumber = socket.playerNumber;
	console.log(`Player ${playerNumber} disconnected from game ${game.gameId}`);

	game.removePlayer(socket);
	
	if (game.players.size === 0) {
		handleEmptyGame(game);
	} else {
		handleRemainingPlayers(game, playerNumber);
	}
	cleanUpSocketListeners(socket);
}

export function removeMessageListeners(socket) {
	try{
		socket.removeAllListeners();
		console.log(`Removed message and close listeners from socket`);
	} catch (e) {
		console.error('Error removing message listeners:', e);
	}
}

function validateDisconnectParams(socket, game) {
	if (!socket.playerNumber) {
		console.error('Player number not found for disconnection handling');
		return false;
	}
	if (!game) {
		console.error('Game not found for disconnection handling');
		return false;
	}
	// Check if player is still in the game's player list
	if (!game.players.has(socket.clientId)) {
		console.error('Player not found in game for disconnection handling');
		return false;
	}
	return true;
}

function handleEmptyGame(game) {
	console.log(`Game ${game.gameId} is empty, removed it`);
	games.delete(game.gameId);
}

function handleRemainingPlayers(game, disconnectedPlayerNumber) {
	try {
		// Get the remaining player and determine the winner
		let remainingPlayer = null;
		game.players.forEach((player) => {
			remainingPlayer = player;
		});
		if (remainingPlayer) {
			const winnerNumber = remainingPlayer.playerNumber;

			// Update scores to reflect the disconnect
			if (disconnectedPlayerNumber === 1) {
				game.gameState.score.player2Score = game.settings.maxScore || 5;
			} else {
				game.gameState.score.player1Score = game.settings.maxScore || 5;
			}

			// Notify remaining player about the disconnect
			safeSend(remainingPlayer, {
				type: 'gameOver',
				reason: 'opponentDisconnected',
				winner: winnerNumber,
				score1: game.gameState.score.player1Score,
				score2: game.gameState.score.player2Score,
				message: `Player ${disconnectedPlayerNumber} disconnected. You win!`
			});

			// Update the game state for the remaining player
			broadcastGameState(game);

			// Schedule game cleanup after delay
			scheduleGameCleanup(game.gameId);
		}
	} catch (e) {
		console.error('Error handling remaining players:', e);
	}
}

function scheduleGameCleanup(gameId, delay = 10000) {
	setTimeout(() => {
		if (games.has(gameId)) {
			games.delete(gameId);
			console.log(`Game ${gameId} removed after player disconnect`);
		}
	}, delay);
}

function cleanUpSocketListeners(socket) {
	try {
		const playerNum = socket.playerNumber;

		socket.removeAllListeners('message');
		socket.removeAllListeners('close');
		socket.removeAllListeners('error');

		socket.gameInstance = null;
		socket.isDisconnecting = true;
		socket.playerNumber = null;

		console.log(`Cleaned up listeners for player ${playerNum}`);
	} catch (e) {
		console.error('Error cleaning up socket listeners:', e);
	}
}
import { games, broadcastGameState } from '../controllers/gameController.js';
import { safeSend } from '../utils/socketUtils.js';

export function handleDisconnect(socket, game) {
	if (!validateDisconnectParams(socket, game)) return;

	const playerNumber = socket.playerNumber;
	console.log(`Player ${playerNumber} disconnected from game ${game.gameId}`);

	game.removePlayer(socket);
	
	if (game.players.size === 0) {
		game.cleanup();
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


function handleRemainingPlayers(game, disconnectedPlayerNumber) {
	try {
		// Get the remaining player and determine the winner
		let remainingPlayer = null;
		game.players.forEach((player) => {
			remainingPlayer = player;
		});
		if (remainingPlayer) {
			const score = game.getState().score;
			const winnerNumber = remainingPlayer.playerNumber;
			const entries = Array.from(game.players.entries());
			const [player1Id] = entries[0];
			const [player2Id] = entries[1];
			const winnerId = score.player1Score > score.player2Score ? player1Id : player2Id;

			try {
				// Insert game record
				const gameQuery = `
					INSERT INTO games (
						player1_id, 
						player2_id, 
						score_player1, 
						score_player2, 
						winner_id
					) VALUES (?, ?, ?, ?, ?)
				`;
				db.prepare(gameQuery).run(
					player1Id,
					player2Id,
					score.player1Score,
					score.player2Score,
					winnerId
				);

				// Update player stats
				const updateWinnerQuery = `
					UPDATE users 
					SET wins = wins + 1 
					WHERE id = ?
				`;
				const updateLoserQuery = `
					UPDATE users 
					SET losses = losses + 1 
					WHERE id = ?
				`;

				db.prepare(updateWinnerQuery).run(winnerId);
				db.prepare(updateLoserQuery).run(winnerId === player1Id ? player2Id : player1Id);

			} catch (error) {
				console.error('Error saving game statistics:', error);
			}

			// Notify remaining player about the disconnect
			safeSend(remainingPlayer, {
				type: 'gameOver',
				reason: 'opponentDisconnected',
				winner: winnerNumber,
				score1: score.player1Score,
				score2: score.player2Score,
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
		const game = games.get(gameId);
		if (game) {
			game.cleanup();
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
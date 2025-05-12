import { games, broadcastGameState } from '../controllers/gameController.js';
import { safeSend } from '../utils/socketUtils.js';
import { tournaments } from '../../routes/game.routes.js';

export function handleDisconnect(socket, game, fastify) {
	if (!validateDisconnectParams(socket, game)) return;

	const playerNumber = socket.playerNumber;
	console.log(`Player ${playerNumber} disconnected from game ${game.gameId}`);

	const tournament = findTournamentByGameId(game.gameId);
	if (tournament) {
		if (!tournament.ended) {
			tournament.ended = true;
			console.log(`Player ${playerNumber} disconnected from tournament ${tournament.tournamentId}`);

			// Use the score from the current game or a default score
			const score = game.getState().score || {
				player1: { name: "Player1", score: 0 },
				player2: { name: "Player2", score: 0 }
			};

			notifyTournamentPlayers( tournament, score, `A player disconnected. The tournament has ended.`);
		}
		game.removePlayer(socket);
		cleanUpSocketListeners(socket);
		const userConnections = fastify.connections.get(socket.clientId);
		if (userConnections)
			userConnections.delete(socket.connectionId);
		const idx = tournament.players.indexOf(socket.clientId);
		if (idx !== -1) {
			tournament.players.splice(idx, 1);
		}
		if (tournament.players.size === 0)
			tournaments.delete(tournament.tournamentId);
		return;
	}
	game.removePlayer(socket);
	if (game.players.size === 1) {
		handleRemainingPlayers(game, playerNumber);
		saveGameResults(game, fastify);
	}
	cleanUpSocketListeners(socket);
	const userConnections = fastify.connections.get(socket.userId);
	if (userConnections)
		userConnections.delete(socket.connectionId);
	if (game.players.size === 0) {
		games.delete(game.gameId);
		const gameId = game.gameId;
		game.cleanup();
		console.log(`Game ${gameId} removed after player disconnect`);
	}
}

function findTournamentByGameId(gameId) {
	for (const tournament of tournaments.values()) {
		if (tournament.bracket.some(match => match.matchId === gameId)) {
			return tournament;
		}
	}
	return null;
}

function notifyTournamentPlayers(tournament, score, message) {
	try {
		for (const match of tournament.bracket) {
			for (const player of match.players) {
				if (player.gameSocket && player.gameSocket.readyState === 1) { // 1 = OPEN
					safeSend(player.gameSocket, {
						type: 'gameOver',
						reason: 'tournamentEnded',
						finalScore: {
							player1: { name: score.player1?.name || "Player1", score: score.player1?.score ?? 0 },
							player2: { name: score.player2?.name || "Player2", score: score.player2?.score ?? 0 }
						},
						message: message || "The tournament has ended due to a player disconnect."
					});
				}
			}
		}
	} catch (e) {
		console.error('Error notifying tournament players:', e);
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

function saveGameResults(game, fastify) {
	try {
		console.log('Saving game results...');
		const score = game.getState().score;
		const entries = Array.from(game.players.entries());
		if (entries.length < 2) {
			console.error('Not enough players to save game results');
			return;
		}
		// Get player IDs
		const [player1Id] = entries[0];
		const [player2Id] = entries[1];
		const winnerId = score.player1Score > score.player2Score ? player1Id : player2Id;

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
		fastify.db.prepare(gameQuery).run(
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

		fastify.db.prepare(updateWinnerQuery).run(winnerId);
		fastify.db.prepare(updateLoserQuery).run(winnerId === player1Id ? player2Id : player1Id);

	} catch (error) {
		console.error('Error saving game statistics:', error);
	}
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


			// Notify remaining player about the disconnect
			safeSend(remainingPlayer, {
				type: 'gameOver',
				reason: 'opponentDisconnected',
				winner: winnerNumber,
				winnerDisplayName: remainingPlayer.displayName,
				finalScore: {
					player1: { name: score.player1?.name || "Player1", score: score.player1?.score ?? 0 },
					player2: { name: score.player2?.name || "Player2", score: score.player2?.score ?? 0 }
				},
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

function scheduleGameCleanup(gameId, delay = 5000) {
	console.log(`Scheduling game cleanup for game ${gameId} after ${delay}ms`);
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
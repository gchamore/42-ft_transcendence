import WebSocket from 'ws';
import { safeSend } from '../utils/socketUtils.js';
import { handleDisconnect } from './disconnectHandler.js';
import { tournaments, tournamentPlayerNumbers, tournamentDisplayNames } from '../../routes/game.routes.js';


export function handleNewGamePlayer(socket, game, fastify, isTournament) {
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

	if (game.players.size === 2) {
		let player1Name = "Player1";
		let player2Name = "Player2";

		if (isTournament) {
			for (const tournament of tournaments.values()) {
				const match = tournament.bracket.find(match => match.matchId === game.gameId);
				if (match) {
					const p1 = match.players.find(player => player.number === 1);
					const p2 = match.players.find(player => player.number === 2);
					if (p1) player1Name = p1.displayName || player1Name;
					if (p2) player2Name = p2.displayName || player2Name;
					break;
				}
			}
		} else {
			let player1 = game.players.get(1);
			let player2 = game.players.get(2);
			if (player1 && player1.clientId)
				player1Name = fastify.db.prepare('SELECT username FROM users WHERE id = ?').get(player1.clientId)?.username || player1Name;
			if (player2 && player2.clientId)
				player2Name = fastify.db.prepare('SELECT username FROM users WHERE id = ?').get(player2.clientId)?.username || player2Name;
		}


		const gameState = game.getState();
		gameState.score.player1.name = player1Name;
		gameState.score.player2.name = player2Name;
	}

	// Attach game instance to socket
	socket.gameInstance = game;
	const playerNumber = socket.playerNumber;
	socket.isAlive = true;

	if (isTournament) {
		for (const tournament of tournaments.values()) {
			const match = tournament.bracket.find(match => match.matchId === game.gameId);
			if (match) {
				const playerObj = match.players.find(player => String(player.id) === String(socket.clientId));
				if (playerObj) {
					playerObj.gameSocket = socket; // Store the socket reference
				}
			}
		}
		socket.on('message', (message) => {
			const data = JSON.parse(message);
			if (socket.currentHandler) {
				socket.currentHandler(data);
			} else {
				console.error('No handler set for incoming message');
			}
		});

		socket.on('close', (code, reason) => {
			if (code === 1000 || (reason && reason.toString().includes('Game Finished'))) {
				console.log(`Socket closed intentionally (code: ${code}, reason: ${reason}). Not treating as disconnect.`);
				if (socket.gameInstance && socket.playerNumber)
					socket.gameInstance.removePlayer(socket);
				return;
			}
			if (socket.currentCloseHandler) {
				socket.currentCloseHandler(fastify);
			} else {
				console.error('No close handler set for socket');
			}
		});
		console.log(`socket.on close handler set for player ${playerNumber}`);
	}

	socket.currentHandler = (data) => handleGameMessage(socket, game, data, fastify);
	socket.currentCloseHandler = (fastify) => handleGameDisconnect(socket, game, fastify);

	console.log(`Player ${playerNumber} joined game ${game.gameId}`);

	// Send welcome messages
	safeSend(socket, {
		type: 'playerNumber',
		playerNumber: playerNumber
	});

	safeSend(socket, {
		type: 'gameState',
		gameState: game.getState()
	});
}

export function handleGameDisconnect(socket, game, fastify) {
	if (!socket || socket.isDisconnecting) return;
	socket.isDisconnecting = true;

	const playerNum = socket.playerNumber;
	const gameInst = socket.gameInstance;
	console.log(`Player ${playerNum} disconnected from on.close`);

	if (gameInst) {
		handleDisconnect(socket, gameInst, fastify);
	} else {
		console.error('Game instance not found for player disconnect');
	}
}

export function handleGameMessage(socket, game, data, fastify) {
	const playerNumber = socket.playerNumber;
	switch (data.type) {
		case 'startGame':
			handleStartGame(socket, game, playerNumber);
			break;
		case 'movePaddle':
			handleMovePaddle(socket, game, playerNumber, data);
			break;
		case 'pong':
			socket.isAlive = true;
			break;
		case 'gameOver':
			handleGameOver(data, fastify);
			break;
		default:
			console.error(`Unknown message in game type: ${data.type}`);
	}
}

function handleStartGame(socket, game, playerNumber) {
	const gameState = game.gameStateManager.getState();
	if (playerNumber === gameState.servingPlayer) {
		console.log('players length', game.players.size);
		if (game.players.size === 2) {
			console.log(`Player ${playerNumber} starting game ${game.gameId}`);
			gameState.gameStarted = true;
		}
	}
	return;
}

function handleGameOver(data, fastify) {
	const tid = Number(data.matchId.split('-')[0]);
	if (data.matchId && tournaments.has(tid)) {
		const tournament = tournaments.get(tid);
		if (tournament) {
			const match = tournament.bracket.find((match) => match.matchId === data.matchId);
			if (match && !match.winner) {
				match.winner = data.winner;
				console.log(`Match ${data.matchId} winner: ${data.winner}`);
			} else {
				console.log(`Match ${data.matchId} already has a winner: ${match.winner}, ignoring duplicate gameOver`);
				return;
			}
			handleTournamentCompletion(tournament, tid, fastify);
			handleSemifinalCompletion(tournament, fastify);
		}
	} else {
		console.log(`regular game over: ${data.matchId} winner is ${data.winner}`);
	}
}

function handleTournamentCompletion(tournament, tid, fastify) {
	const finalMatch = tournament.bracket.find(m => m.round === 'final');
	const thirdMatch = tournament.bracket.find(m => m.round === 'third');
	// If both final and third place are finished, send tournament results
	if (finalMatch && finalMatch.winner && thirdMatch && thirdMatch.winner) {
		const winnerPlayer = finalMatch.players.find(p => p.number === finalMatch.winner);
		const runnerUp = finalMatch.players.find(p => p.number !== finalMatch.winner);
		const thirdPlayer = thirdMatch.players.find(p => p.number === thirdMatch.winner);
		const fourthPlayer = thirdMatch.players.find(p => p.number !== thirdMatch.winner);

		const placements = [
			{ place: 1, name: winnerPlayer.displayName },
			{ place: 2, name: runnerUp.displayName },
			{ place: 3, name: thirdPlayer.displayName },
			{ place: 4, name: fourthPlayer.displayName }
		];

		notifyTournamentResults(tournament, placements, winnerPlayer.displayName, fastify);
		cleanupTournamentMappings(tournament);
		tournaments.delete(tid);
		console.log(`Tournament ${tournament.id} cleaned up after completion.`);
	}
}

function notifyTournamentResults(tournament, placements, winnerName, fastify) {
	const allPlayers = new Set();
	tournament.bracket.forEach(match => match.players.forEach(p => allPlayers.add(p.id)));
	setTimeout(() => { // <-- Add delay here
		for (const playerId of allPlayers) {
			const userConnections = fastify.connections.get(String(playerId));
			if (userConnections) {
				for (const [, socket] of userConnections.entries()) {
					if (socket.readyState === 1) {
						safeSend(socket, {
							type: 'tournamentResults',
							placements,
							message: `🏆 ${winnerName} wins the tournament!`
						});
					}
				}
			}
		}
	}, 2000); // 2000ms = 2 seconds delay
}

function handleSemifinalCompletion(tournament, fastify) {
	const semis = tournament.bracket.filter((match) => match.round === 'semifinal');
	const finalExists = tournament.bracket.some(m => m.round === 'final');
	const thirdExists = tournament.bracket.some(m => m.round === 'third');
	if (semis.length === 2 && semis.every((match) => match.winner) && !finalExists && !thirdExists) {
		// Find winner and loser objects (with displayName) for both semis
		const semi1Winner = semis[0].players.find(p => p.number === semis[0].winner);
		const semi1Loser = semis[0].players.find(p => p.number !== semis[0].winner);
		const semi2Winner = semis[1].players.find(p => p.number === semis[1].winner);
		const semi2Loser = semis[1].players.find(p => p.number !== semis[1].winner);
		const finalMatch = {
			matchId: `${tournament.id}-final`,
			round: 'final',
			players: [
				{ id: semi1Winner.id, number: 1, displayName: semi1Winner.displayName },
				{ id: semi2Winner.id, number: 2, displayName: semi2Winner.displayName }
			],
			winner: null,
			loser: null
		};
		const thirdPlaceMatch = {
			matchId: `${tournament.id}-third`,
			round: 'third',
			players: [
				{ id: semi1Loser.id, number: 1, displayName: semi1Loser.displayName },
				{ id: semi2Loser.id, number: 2, displayName: semi2Loser.displayName }
			],
			winner: null,
			loser: null
		};
		tournament.bracket.push(finalMatch, thirdPlaceMatch);
		console.log(`Final match created: ${finalMatch.matchId}`);
		console.log(`[Tournament Notify] Final:`, finalMatch.players.map(p => p.displayName));
		notifyMatchPlayers(finalMatch, fastify);
		console.log(`Third place match created: ${thirdPlaceMatch.matchId}`);
		console.log(`[Tournament Notify] Third:`, thirdPlaceMatch.players.map(p => p.id));
		notifyMatchPlayers(thirdPlaceMatch, fastify);
	}
}

function notifyMatchPlayers(match, fastify) {
	match.players.forEach(player => {
		const userConnections = fastify.connections.get(String(player.id));
		if (userConnections) {
			for (const [, socket] of userConnections.entries()) {
				if (socket.readyState === 1) {
					safeSend(socket, {
						type: 'TournamentGameStart',
						gameId: match.matchId,
						round: match.round,
						players: match.players.map(p => p.displayName),
						playerNumber: player.number,
					});
					break; // Only notify the first open socket
				}
			}
		}
	});
}

export function cleanupTournamentMappings(tournament) {
	for (const match of tournament.bracket) {
		for (const player of match.players) {
			tournamentPlayerNumbers.delete(String(player.id));
			tournamentDisplayNames.delete(player.id);
		}
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
	const gameState = game.gameStateManager.getState();
	const paddle = gameState[`paddle${playerNumber}`];
	// validate input sequence
	if (data.inputSequence <= paddle.lastProcessedInput) {
		return;
	}
	paddle.y = data.paddlePosition;
	paddle.lastProcessedInput = data.inputSequence;
}

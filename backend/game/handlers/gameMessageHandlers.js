import WebSocket from 'ws';
import { safeSend } from '../utils/socketUtils.js';
import { handleDisconnect } from './disconnectHandler.js';
import { tournaments } from '../../routes/game.routes.js';


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

	// Attach game instance to socket
	socket.gameInstance = game;
	const playerNumber = socket.playerNumber;
	socket.isAlive = true;

	if (isTournament) {
		socket.on('message', (message) => {
			const data = JSON.parse(message);
			if (socket.currentHandler) {
				socket.currentHandler(data);
			} else {
				console.error('No handler set for incoming message');
			}
		});

		socket.on('close', () => {
			if (socket.currentCloseHandler) {
				socket.currentCloseHandler();
			} else {
				console.error('No close handler set for socket');
			}
		});
	}

	socket.currentHandler = (data) => handleGameMessage(socket, game, data, fastify);
	socket.currentCloseHandler = () => handleGameDisconnect(socket, game, fastify);

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
		default:
			console.error(`Unknown message type: ${data.type}`);
	}
}

function handleStartGame(socket, game, playerNumber) {
	const gameState = game.gameStateManager.getState();
	if (playerNumber === gameState.servingPlayer) {
		console.log('players length', game.players.size);
		if (game.players.size === 2) {
			console.log(`Player ${playerNumber} starting game ${game.gameId}`);
			gameState.gameStarted = true;
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
	const gameState = game.gameStateManager.getState();
	const paddle = gameState[`paddle${playerNumber}`];
	// validate input sequence
	if (data.inputSequence <= paddle.lastProcessedInput) {
		return;
	}

	paddle.y = data.paddlePosition;
	paddle.lastProcessedInput = data.inputSequence;
}

function handleGameOver(data, fastify) {
	if (data.matchId && tournaments.has(data.matchId.split('-')[0])) {
		const tournament = tournaments.get(matchId.split('-')[0]);
		if (tournament) {
			const match = tournament.bracket.find((match) => match.matchId === data.matchId);
			if (match) {
				match.winner = winner;
				console.log(`Match ${data.matchId} winner: ${winner}`);
			} else {
				console.error(`Match ${data.matchId} not found in tournament bracket`);
			}
			const semis = tournament.bracket.filter((match) => match.round === 'semifinal');
			if (semis.length === 2 && semis.every((match) => match.winner)) {
				const finalMatch = {
					matchId: `${matchId}-final`,
					round: 'final',
					players: [
						{ id: semis[0].winner, number: 1 },
						{ id: semis[1].winner, number: 2 }
					],
					winner: null,
					loser: null
				};
				const thirdPlaceMatch = {
					matchId: `${tournament.id}-third`,
					round: 'third',
					players: [
						{ id: semis[0].players.find(p => p.id !== semis[0].winner).id, number: 1 },
						{ id: semis[1].players.find(p => p.id !== semis[1].winner).id, number: 2 }
					],
					winner: null,
					loser: null
				};
				tournament.bracket.push(finalMatch, thirdPlaceMatch);
				console.log(`Final match created: ${finalMatch.matchId}`);
				// Notify final players
				finalMatch.players.forEach(playerId => {
					const userConnections = fastify.connections.get(playerId);
					if (userConnections) {
						for (const [, socket] of userConnections.entries()) {
							if (socket.readyState === 1) {
								safeSend(socket, {
									type: 'TournamentGameStart',
									gameId: finalMatch.matchId,
									round: finalMatch.round,
									players: finalMatch.players.map(p => p.id),
								});
								socket.close();
								break; // Only notify the first open socket
							}
						}
					}
				});
				// Notify third place players
				thirdPlaceMatch.players.forEach(playerId => {
					const userConnections = fastify.connections.get(playerId);
					if (userConnections) {
						for (const [, socket] of userConnections.entries()) {
							if (socket.readyState === 1) {
								safeSend(socket, {
									type: 'TournamentGameStart',
									gameId: thirdPlaceMatch.matchId,
									round: thirdPlaceMatch.round,
									players: thirdPlaceMatch.players.map(p => p.id),
								});
								socket.close();
								break;
							}
						}
					}
				});
			}
		}
	} else {
		console.log(`regular game over: ${data.matchId} winner is ${data.winner}`);
	}
}

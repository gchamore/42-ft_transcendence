import Fastify from 'fastify';
import fastifyWebSocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { join } from 'path';
import WebSocket from 'ws';
import { GameInstance } from './src/classes/gameInstance.js';

let mainLobby = null; // Main lobby for settings need to change it when implementing multiple lobbies

const fastify = Fastify({ logger: true });


fastify.get('/game/status/:gameId', async (request, reply) => {
	const { gameId } = request.params;
	const gameExists = games.has(gameId);

	if (gameExists) {
		return { exists: true };
	}

	reply.code(404);
	return { exists: false };
});

// Register fastify websocket plugin
fastify.register(fastifyWebSocket);

// Register fastify static plugin to serve static files
fastify.register(fastifyStatic, {
	root: join(process.cwd(), 'public'),
	prefix: '/',
	list: true,
	index: 'index.html'
});

const games = new Map(); // Map to store game instances

// Register the Websocket route inside an encapsulated plugin
fastify.register(async function (fastify) {
	fastify.get('/game/:gameId', { websocket: true }, (connection, req) => {
		const socket = connection.socket;
		const { gameId } = req.params; // Get gameId from URL
		console.log('WebSocket connection established for game:', { gameId });
		if (gameId === 'lobby-main') {
			if (!mainLobby) {
				mainLobby = new GameInstance(gameId);
				console.log('Main lobby created');
			}
			handleNewPlayer(socket, mainLobby);
		} else {
			// Handle actual game connections
			let game = games.get(gameId);
			if (!game) {
				game = new GameInstance(gameId);
				games.set(gameId, game);
			}
			handleNewPlayer(socket, game);
		}
	});
});

// Add game update interval
setInterval(() => {
	games.forEach((game, gameId) => {
		if (gameId.startsWith('lobby-')) return;
		if (game.players.length > 0) {
			// process full game only if the game is started and has 2 players
			if (game.gameState.gameStarted && game.players.length === 2) {
				const result = game.update(); //check for collisions and scoring
				broadcastGameState(game);
				if (result.scored) {
					if (result.winner) {
						game.players.forEach((player) => {
							safeSend(player, {
								type: 'gameOver',
								reason: 'scoreLimit',
								winner: result.winner,
								score1: game.gameState.score.player1Score,
								score2: game.gameState.score.player2Score,
								message: `Player ${result.winner} wins!`
							});
						});
						game.gameState.gameStarted = false;
					}
				}
			} else { // occasionnal update for paddle movement
				if (game.paddleMoved) {
					broadcastGameState(game);
					game.paddleMoved = false;
				}
			}
		}
	});
}, 1000 / 60);  // 60 FPS update rate

function handleNewPlayer(socket, game) {
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

	// attach game instance to socket
	socket.gameInstance = game;

	const playerNumber = socket.playerNumber;
	console.log(`Player ${playerNumber} joined game ${game.gameId}`);

	safeSend(socket, {
		type: 'playerNumber',
		playerNumber: playerNumber
	});

	// Send welcome message first
	safeSend(socket, {
		type: 'connected',
		message: `Welcome Player ${playerNumber}!`,
		gameId: game.gameId
	});

	// Send initial game state with player number
	safeSend(socket, {
		type: 'gameState',
		gameState: game.getState()
	});

	safeSend(socket, {
		type: 'settingsUpdate',
		settings: game.settings
	});

	socket.on('message', message => {
		const data = JSON.parse(message);
		handleGameMessage(socket, game, data);
	});

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

function handleGameMessage(socket, game, data) {
	const playerNumber = socket.playerNumber;
	switch (data.type) {
		case 'playerReady':
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
			break;
		case 'startGameRequest':
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
			break;
		case 'startGame':
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
			}
			break;
		case 'movePaddle':
			if (data.player !== playerNumber) {
				safeSend(socket, {
					type: 'error',
					message: 'Player trying to move paddle that is not theirs'
				});
				console.error('Player trying to move paddle that is not theirs');
				return;
			}
			//server side validation
			const previousPosition = game.gameState[`paddle${playerNumber}`].y;
			const newPosition = data.y;
			const maxMove = game.gameState[`paddle${playerNumber}`].speed * 2;
			if (Math.abs(newPosition - previousPosition) > maxMove) {
				console.log(`Suspicious paddle movement detected: Player ${playerNumber} moved ${Math.abs(newPosition - previousPosition)}px (${previousPosition} to ${newPosition})`);
				// Hybrid approach:
				// 1. Accept the move if it's within a larger tolerance (allows for occasional lag spikes)
				// 2. Reject if it's way beyond reasonable
				const absoluteMaxMove = maxMove * 3;

				if (Math.abs(newPosition - previousPosition) > absoluteMaxMove) {
					// if cheating or a severe bug - reject the move
					safeSend(socket, {
						type: 'syncPaddle',
						position: previousPosition,
						message: 'Movement rejected - too large'
					});
					// Use previous position instead
					game.updatePaddlePosition(data.player, previousPosition);
				} else {
					// Accept but likely network lag
					game.updatePaddlePosition(data.player, data.y);
				}
			} else {
				game.updatePaddlePosition(data.player, data.y);
			}
			break;
		case 'updateSettings': //client to server
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
			break;
		case 'rematchRequest':
			const otherPlayer = game.players.find(player => player.playerNumber !== playerNumber);
			if (!game.rematchRequested) {
				game.rematchRequested = playerNumber;
				if (otherPlayer) {
					safeSend(otherPlayer, {
						type: 'rematchRequested',
						player: playerNumber
					});
				}
			} else if (game.rematchRequested && game.rematchRequested !== playerNumber) {
				game.resetForRematch();
				game.players.forEach((player) => {
					safeSend(player, {
						type: 'rematch'
					});
				});
				game.rematchRequested = null;
			}
			break;
	}
	broadcastGameState(game);
}

//prevent local crash with failed connection
function safeSend(socket, message) {
	if (socket.readyState === WebSocket.OPEN) {
		try {
			const jsonMessage = JSON.stringify(message);
			socket.send(jsonMessage);
		} catch (e) {
			console.error('Error sending message:', e);
		}
	}
	else {
		console.warn('Cannot send message, socket state:', {
			current: socket.readyState,
			states: {
				CONNECTING: WebSocket.CONNECTING,
				OPEN: WebSocket.OPEN,
				CLOSING: WebSocket.CLOSING,
				CLOSED: WebSocket.CLOSED
			},
			expectedState: `OPEN (${WebSocket.OPEN})`
		});
	}
}

function handleDisconnect(socket, game) {

	if (!socket.playerNumber) {
		console.error('Player number not found for disconnection handling');
		return;
	}

	if (!game) {
		console.error('Game not found for disconnection handling');
		return;
	}
	// Skip if player is no longer in the game's player list
	const playerIndex = game.players.indexOf(socket);
	if (playerIndex === -1) {
		console.error('Player not found in game for disconnection handling');
		return;
	}
	try {
		const playerNumber = socket.playerNumber;
		console.log(`Player ${playerNumber} disconnected from game ${game.gameId}`);

		cleanUpSocketListeners(socket);

		game.removePlayer(socket);

		if (game.players.length === 0) {
			// Remove empty game
			console.log(`Game ${game.gameId} is empty, removed it`);
			games.delete(game.gameId);
		} else {
			// Notify remaining player
			const remainingPlayer = game.players[0];
			const winnerNumber = remainingPlayer.playerNumber;
			if (playerNumber === 1) {
				game.gameState.score.player2Score = game.settings.maxScore || 5;
			} else {
				game.gameState.score.player1Score = game.settings.maxScore || 5;
			}
			safeSend(remainingPlayer, {
				type: 'gameOver',
                reason: 'opponentDisconnected',
                winner: winnerNumber,
                score1: game.gameState.score.player1Score,
                score2: game.gameState.score.player2Score,
                message: `Player ${playerNumber} disconnected. You win!`
			});
			broadcastGameState(game);

			//allow the remaining player some time to see results before clean up
			setTimeout(() => {
				if (games.has(game.gameId)) {
					games.delete(game.gameId);
					console.log(`Game ${game.gameId} removed after player disconnect`);
				}
			}, 10000); // 10 seconds
		}
	} catch (e) {
		console.error('Error handling disconnect:', e);
	}
}

function cleanUpSocketListeners(socket) {
	try{
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

function broadcastGameState(game) {
	game.players.forEach((player) => {
		safeSend(player, {
			type: 'gameState',
			gameState: game.getState()
		});
	});
}

fastify.listen({ port: 3000 }, (err, address) => {
	if (err) {
		console.error(err);
		process.exit(1);
	}
	console.log(`Server is running at ${address}`);
});

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
		const { gameId } = req.params; // Get gameId from URL
		console.log('WebSocket connection established for game:', { gameId });
		const socket = connection.socket;
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
	games.forEach((game) => {
		if (game.gameState.gameStarted && game.players.length === 2) {
			game.updateBall(game.gameState.ball.x + game.gameState.ball.xSpeed,
				game.gameState.ball.y + game.gameState.ball.ySpeed); // Update ball position
			broadcastGameState(game);
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

	socket.GameInstance = game;

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
		data: game.getState(),
		playerNumber: playerNumber
	});

	safeSend(socket, {
		type: 'settingsUpdate',
		data: game.settings
	});

	socket.on('message', message => {
		const data = JSON.parse(message);
		handleGameMessage(socket, game, data);
	});

	socket.on('close', () => {
		console.log(`Player ${socket.playerNumber} disconnected`);
		if (socket.gameInstance) {
			handleDisconnect(socket, socket.gameInstance);
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
					const gameInstance = game.transitionToGame(newGameId);
					games.set(newGameId, gameInstance);
					games.delete(game.gameId);
		
					game.players.forEach((player) => {
						safeSend(player, {
							type: 'gameStart',
							gameId: newGameId,
							settings: game.settings
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
			if (game.players.length === 2) {
				game.gameState.gameStarted = true;
			} else {
				safeSend(socket, {
					type: 'error',
					message: 'Waiting for another player to join'
				});
				return;
			}
			break;
		case 'movePaddle':
			if (!game.gameState.gameStarted) {
				safeSend(socket, {
					type: 'error',
					message: 'Cannot move paddle Game has not started'
				});
				console.log('Cannot move paddle Game has not started');
				return;
			}
			if (data.player !== playerNumber) {
				safeSend(socket, {
					type: 'error',
					message: 'Player trying to move paddle that is not theirs'
				});
				console.error('Player trying to move paddle that is not theirs');
				return;
			}
			game.updatePaddlePosition(data.player, data.y);
			break;
		case 'playerDisconnect':
			console.log(data.message);
			handleDisconnect(socket);
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

	if (!game) {
		console.error('Game not found');
		return;
	}
	try {
		game.removePlayer(socket);

		if (game.players.length === 0) {
			// Remove empty game
			games.delete(game.gameId);
			console.log(`Game ${game.gameId} removed`);
		} else {
			// Notify remaining player
			const remainingPlayer = game.players[0];
			safeSend(remainingPlayer, {
				type: 'gameOver',
				reason: 'Opponent disconnected'
			});
			broadcastGameState(game);
		}
	} catch (e) {
		console.error('Error handling disconnect:', e);
	}
}

function broadcastGameState(game) {
	game.players.forEach((player) => {
		safeSend(player, {
			type: 'gameState',
			data: game.getState()
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

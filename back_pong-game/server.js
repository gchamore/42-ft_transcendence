import Fastify from 'fastify';
import fastifyWebSocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { join } from 'path';
import WebSocket from 'ws';

const fastify = Fastify({ logger: true });

// Register fastify websocket plugin
fastify.register(fastifyWebSocket);

// Register fastify static plugin to serve static files
fastify.register(fastifyStatic, {
	root: join(process.cwd(), 'public'),
	prefix: '/',
	list: true,
	index: 'index.html'
});

// Register the Websocket route inside an encapsulated plugin
fastify.register(async function (fastify) {
	fastify.get('/game', { websocket: true }, (socket, req) => {
		handleNewPlayer(socket);
	});
})

let gameState = {
	ball: { x: 400, y: 300, radius: 10, xSpeed: 4, ySpeed: 4 },
	paddle1: { x: 10, y: 250, width: 10, height: 100, speed: 4 },
	paddle2: { x: 780, y: 250, width: 10, height: 100, speed: 4 },
	score1: 0,
	score2: 0,
	servingPlayer: Math.random() < 0.5 ? 1 : 2,
	gameStarted: false
};

let players = [];

function handleNewPlayer(socket) {
	console.log('WebSocket connection state:', {
		readyState: socket.readyState,
		isOpen: socket.readyState === WebSocket.OPEN,
		stateMap: {
			[WebSocket.CONNECTING]: 'CONNECTING',
			[WebSocket.OPEN]: 'OPEN',
			[WebSocket.CLOSING]: 'CLOSING',
			[WebSocket.CLOSED]: 'CLOSED'
		}
	});

	// Verify socket is open
	if (socket.readyState !== WebSocket.OPEN) {
		console.error('Socket not in OPEN state');
		return;
	}

	// Limit players to 2
	if (players.length >= 2) {
		console.log('Game is full');
		socket.close();
		return;
	}

	const playerNumber = players.length + 1;
	socket.playerNumber = playerNumber;
	players.push(socket);

	console.log(`Player ${playerNumber} has connected. Total players: ${players.length}`);

	// Send welcome message first
	safeSend(socket, {
		type: 'connected',
		message: `Welcome Player ${playerNumber}!`
	});

	safeSend(socket, {
		type: 'gameState',
		data: gameState,
		playerNumber: playerNumber
	});

	socket.on('message', message => {
		const data = JSON.parse(message);
		switch (data.type) {
			case 'startGame':
				if (players.length === 2) {
					gameState.gameStarted = true;
				} else {
					safeSend(socket, {
						type: 'error',
						message: 'Waiting for another player to join'
					});
					return;
				}
				break;
			case 'movePaddle':
				if (!gameState.gameStarted) {
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
				if (data.player === 1) {
					gameState.paddle1.y = data.y; //Update left paddle position
				} else {
					gameState.paddle2.y = data.y; //Update right paddle position
				}
				break;
			case 'playerDisconnect':
				console.log(data.message);
				handleDisconnect(socket);
				break;
		}
		broadcastGameState(gameState);
	});

	socket.on('close', () => {
		console.log('A player has disconnected');
		handleDisconnect(socket);
	});
}

fastify.get('/', (req, reply) => {
	reply.sendFile('index.html');
});

//prevent local crash with failed connection
function safeSend(socket, message) {
	console.log('Attempting to send message:', {
		socketState: socket.readyState,
		stateAsString: socket.readyState === WebSocket.OPEN ? 'OPEN' : 'NOT_OPEN',
		messageType: message.type
	});
	if (socket.readyState === WebSocket.OPEN) {
		try {
			const jsonMessage = JSON.stringify(message);
			socket.send(jsonMessage);
			console.log('Message sent:', jsonMessage);
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

function handleDisconnect(connection) {

	const playerIndex = players.indexOf(connection);
	if (playerIndex === -1) {
		console.error('Player not found');
		return;
	}
	const disconnectedPlayer = connection.playerNumber;
	players.splice(playerIndex, 1);

	console.log(`Player ${disconnectedPlayerNumber} disconnected. Remaining players: ${players.length}`);

	if (players.length === 0) {
		console.log('No players left. Resetting game state');
	} else if (players.length === 1) {
		const remainingPlayer = players[0];
		const gameOverMessage = {
			type: 'gameOver',
			winner: remainingPlayer.playerNumber === 1 ? 'Player 1' : 'Player 2',
            score1: gameState.score1,
            score2: gameState.score2,
            reason: 'Opponent disconnected'
		};
		safeSend(remainingPlayer, gameOverMessage);
		gameState.gameStarted = false;
		gameState.score1 = 0;
		gameState.score2 = 0;
	}
}

function broadcastGameState(gameState) {
	players.forEach((player) => {
		safeSend(player, {
			type: 'gameState',
			data: gameState
		});
	});
}

function updateServingPlayer() {
	gameState.servingPlayer = gameState.servingPlayer === 1 ? 2 : 1;
}

function updateScore(player) {
	if (player === 1) {
		gameState.score1++;
		gameState.gameStarted = false;
	} else {
		gameState.score2++;
		gameState.gameStarted = false;
	}
	if (gameState.score1 >= 5) {
		broadcastGameState(gameState);
		broadcastGameOver(player);
	} else if (gameState.score2 >= 5) {
		broadcastGameState(gameState);
		broadcastGameOver(player);
	}
	else {
		updateServingPlayer();
		broadcastGameState(gameState);
	}
}

fastify.listen({ port: 3000 }, (err, address) => {
	if (err) {
		console.error(err);
		process.exit(1);
	}
	console.log(`Server is running at ${address}`);
});

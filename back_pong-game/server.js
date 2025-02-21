const Fastify = require('fastify');
const fastify = Fastify();
const fastifyWebSocket = require('fastify-websocket');

fastify.register(fastifyWebSocket);

let gameState = {
	ball: { x: 400, y: 300, radius: 10, xSpeed: 4, ySpeed: 4 },
	paddle1: { x: 10, y: 250, width: 10, height: 100, speed: 4 },
	paddle2: { x: 780, y: 250, width: 10, height: 100, speed: 4 },
	score1: 0,
	score2: 0,
	servingPlayer: 1,
	gameStarted: false
};

let players = [];

fastify.get('/game', { websocket: true }, (connection, req) => {
	console.log('A player has connected');

	players.push(connection);

	connection.send(JSON.stringify({
		type: 'gameState',
		data: gameState
	}));

	connection.on('message', message => {
		const data = JSON.parse(message);
		switch (data.type) {
			case 'startGame':
				gameState.gameStarted = true;
				break;
			case 'movePaddle':
				if (data.player === 1) {
					gameState.paddle1.y = data.y;
				} else {
					gameState.paddle2.y = data.y;
				}
				break;
			case 'playerDisconnect':
				console.log(data.message);
				handleDisconnect(connection);
				break;

		}

		broadcastGameState(gameState);
	});

	connection.on('close', () => {
		console.log('A player has disconnected');
		handleDisconnect(connection);
	});
});

function handleDisconnect(connection) {
	
	const playerIndex = players.indexOf(connection);
	if (playerIndex !== -1) {
		players.splice(playerIndex, 1);
	}

	const winner = players[0];

	const gameOverMessage = {
		type: 'gameOver',
		winner: winner === players[0] ? 'Player 1' : 'Player 2',
		score1: gameState.score1,
		score2: gameState.score2
	};

	players.forEach((player) => {
		if (player.readyState === websocket.OPEN) {
			player.send(JSON.stringify(gameOverMessage));
		}
	});

	gameState.gameStarted = false;
	gameState.score1 = 0;
	gameState.score2 = 0;
	broadcastGameState(gameState);
}

function broadcastGameState(gameState) {
	players.forEach((player) => {
		if (player.readyState === websocket.OPEN) {
			player.send(JSON.stringify({
				type: 'gameState',
				data: gameState
			}));
		}
	});
}

fastify.listen(3000, (err, address) => {
	if (err) {
		console.error(err);
		process.exit(1);
	}
	console.log(`Server is running at ${address}`);
});

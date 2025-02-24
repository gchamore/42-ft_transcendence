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
	servingPlayer: Math.random() < 0.5 ? 1 : 2,
	gameStarted: false
};

let players = [];

fastify.get('/game', { websocket: true }, (connection, req) => {
	console.log('A player has connected');

	const playerNumber = players.length + 1;
	connection.playerNumber = playerNumber;
	players.push(connection);

	connection.send(JSON.stringify({
		type: 'gameState',
		data: gameState,
		playerNumber: connection.playerNumber
	}));

	connection.on('message', message => {
		const data = JSON.parse(message);
		switch (data.type) {
			case 'startGame':
				gameState.gameStarted = true;
				break;
			case 'movePaddle':
				if (data.player !== connection.playerNumber) {
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
	else
	{
		updateServingPlayer();
		broadcastGameState(gameState);
	}
}

fastify.listen(3000, (err, address) => {
	if (err) {
		console.error(err);
		process.exit(1);
	}
	console.log(`Server is running at ${address}`);
});

import { createDefaultGameState } from '../../public/dist/shared/types/gameState.js';

export class GameInstance {
	constructor(gameId) {
		this.gameId = gameId;
		this.isLobby = gameId.startsWith('lobby-');
		this.players = [];
		this.gameState = createDefaultGameState(gameId);
		this.settings = {
			ballSpeed: 4,
			paddleSpeed: 4,
			paddleLength: 100,
			mapType: 'default',
			powerUpsEnabled: false,
		};
		this.playerReadyStatus = new Set();
		this.resetBall();
		this.paddleMoved = false;
	}

	setPlayerReady(playerNumber) {
		this.playerReadyStatus.add(playerNumber);
		return this.playerReadyStatus.size === 2;
	}

	isGameReady() {
		return this.playerReadyStatus.size === 2;
	}

	addPlayer(socket) {
		if (this.players.length >= 2) {
			return false;
		}
		const playerNumber = this.players.length + 1;
		socket.playerNumber = playerNumber;
		this.players.push(socket);
		return true;
	}

	removePlayer(socket) {
		const index = this.players.indexOf(socket);
		if (index > -1) {
			this.players.splice(index, 1);
		}
		if (this.players.length === 0) {
			this.reset();
		}
	}

	reset() {
		this.gameState = createDefaultGameState();
	}

	update() {
		this.gameState.ball.x += this.gameState.ball.speedX;
		this.gameState.ball.y += this.gameState.ball.speedY;
	
		this.checkWallCollision();
		this.checkPaddleCollision();
		return this.checkScoring();
	}
	
	checkWallCollision() {
		const ball = this.gameState.ball;
		if (ball.y - ball.radius <= 0 || ball.y + ball.radius >= 600) {
			ball.speedY *= -1;
		}
	}
	
	checkPaddleCollision() {
		const ball = this.gameState.ball;
		const paddle1 = this.gameState.paddle1;
		const paddle2 = this.gameState.paddle2;
	
		if (ball.speedX < 0 &&
			ball.x - ball.radius <= paddle1.x + paddle1.width &&
			ball.y >= paddle1.y &&
			ball.y <= paddle1.y + paddle1.height) {
			ball.speedX *= -1;
			//add angle based on where the ball hits the paddle
			const hitPosition = (ball.y - paddle1.y) / paddle1.height;
			ball.speedY = (hitPosition - 0.5) * 10;
		}
	
		if (ball.speedX > 0 &&
			ball.x + ball.radius >= paddle2.x &&
			ball.y >= paddle2.y &&
			ball.y <= paddle2.y + paddle2.height) {
			ball.speedX *= -1;
			//add angle based on where the ball hits the paddle
			const hitPosition = (ball.y - paddle2.y) / paddle2.height;
			ball.speedY = (hitPosition - 0.5) * 10;
		}
	}
	
	checkScoring() {
		const ball = this.gameState.ball;
	
		// Player 2 scores
		if (ball.x - ball.radius <= 0) {
			this.gameState.score.player2Score++;
			this.resetBall(2);
			return true;
		}
		// Player 1 scores
		else if (ball.x + ball.radius >= 800) {
			this.gameState.score.player1Score++;
			this.resetBall(1);
			return true;
		}
		return false;
	}

	resetBall(scoringPlayer = null) {
		const ball = this.gameState.ball;
		ball.x = 400;
		ball.y = 300;
		const angle = Math.random() * Math.PI / 2 - Math.PI / 4;
		const speed = this.settings.ballSpeed || 4;
		if (scoringPlayer) {
			ball.speedX = scoringPlayer === 1 ? speed : -speed;
			this.gameState.servingPlayer = scoringPlayer === 1 ? 2 : 1;
		} else {
			// Initial serve - random direction
			ball.speedX = Math.random() > 0.5 ? speed : -speed;
		}

		// Apply the angle
		ball.speedY = Math.sin(angle) * speed;

		// Ensure the game is paused after reset
		this.gameState.gameStarted = false;
	}

	updatePaddlePosition(playerNumber, y) {
		this.paddleMoved = true;
		// Get the correct paddle based on player number
		const paddle = playerNumber === 1 ? this.gameState.paddle1 : this.gameState.paddle2;

		paddle.y = y;
		// Ensure paddle stays within bounds
		if (paddle.y < 0) {
			paddle.y = 0;
		}
		if (paddle.y + paddle.height > 600) {
			paddle.y = 600 - paddle.height;
		}
		return paddle.y;
	}

	cleanup() {
		this.players.forEach(player => player.close());
		this.players = [];
	}

	getState() {
		return this.gameState;
	}

	updateSettings(newSettings) {
		// Update settings that are passed in and keep the rest the same
		this.settings = {
            ...this.settings,
            ...newSettings
        };
		this.gameState.ball.speedX = parseInt(newSettings.ballSpeed);
		this.gameState.ball.speedY = parseInt(newSettings.ballSpeed);
		this.gameState.paddle1.speed = parseInt(newSettings.paddleSpeed);
		this.gameState.paddle2.speed = parseInt(newSettings.paddleSpeed);
		this.gameState.paddle1.height = parseInt(newSettings.paddleLength);
		this.gameState.paddle2.height = parseInt(newSettings.paddleLength);

		return this.settings;
	}

	transitionToGame(newGameId) {
		this.gameId = newGameId;
		this.isLobby = false;
		this.gameState = createDefaultGameState(newGameId);
		this.gameState.servingPlayer = Math.random() < 0.5 ? 1 : 2;
		return this;
	}
}
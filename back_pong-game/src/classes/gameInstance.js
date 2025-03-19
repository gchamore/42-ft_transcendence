import { createDefaultGameState } from "../../public/dist/shared/types/gameState.js";
import { GameConfig } from "../../public/dist/shared/config/gameConfig.js";

export class GameInstance {
	constructor(gameId, existingSettings = null) {
		this.gameId = gameId;
		this.isLobby = gameId.startsWith("lobby-");
		this.players = [];
		this.gameState = createDefaultGameState(gameId);
		this.settings = existingSettings || {
			ballSpeed: GameConfig.DEFAULT_BALL_SPEED,
			paddleSpeed: GameConfig.DEFAULT_PADDLE_SPEED,
			paddleLength: GameConfig.DEFAULT_PADDLE_LENGTH,
			mapType: GameConfig.DEFAULT_MAP,
			powerUpsEnabled: GameConfig.DEFAULT_POWERUPS,
			maxScore: GameConfig.DEFAULT_MAX_SCORE,
		};
		this.playerReadyStatus = new Set();
		this.resetBall();
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

	update(deltaTime) {
		const ball = this.gameState.ball;

		if (this.gameState.gameStarted) {
			ball.x += ball.speedX * deltaTime;
			ball.y += ball.speedY * deltaTime;

			this.checkWallCollision(ball);

			this.checkPaddleCollision(ball);

			const scoreResult = this.checkScoring(ball);

			return scoreResult;
		}
		return { scored: false };
	}

	checkWallCollision() {
		const ball = this.gameState.ball;
		if (ball.y - ball.radius <= 0 || ball.y + ball.radius >= GameConfig.CANVAS_HEIGHT) {
			ball.speedY *= -1;
			// Add small random factor to avoid loops
			ball.speedY += (Math.random() - 0.5) * 0.5;
			return true;
		}
		return false;
	}

	checkPaddleCollision(ball) {
		[1, 2].forEach((playerNumber) => {
			const paddle = this.gameState[`paddle${playerNumber}`];
			if (
				ball.x - ball.radius <= paddle.x + paddle.width &&
				ball.x + ball.radius >= paddle.x &&
				ball.y - ball.radius <= paddle.y + paddle.height &&
				ball.y + ball.radius >= paddle.y
			) {
				ball.speedX *= -1;
				const hitPoint = (ball.y - paddle.y) / paddle.height;
				const currentSpeed = Math.sqrt(
					ball.speedX ** 2 + ball.speedY ** 2
				);

				// Set y velocity based on where the ball hit the paddle
				ball.speedY = (hitPoint - 0.5) * currentSpeed;

				//scale X velocity to maintain total speed
				const newYSpeed = Math.abs(ball.speedY);
				const newXSpeed = Math.sqrt(currentSpeed ** 2 - newYSpeed ** 2);
				ball.speedX = Math.sign(ball.speedX) * newXSpeed;

				const maxSpeed = GameConfig.MAX_BALL_SPEED;
				const speedUpFactor = GameConfig.BALL_SPEEDUP_FACTOR;

				const newSpeed = currentSpeed * speedUpFactor;
				if (newSpeed <= maxSpeed) {
					ball.speedX *= speedUpFactor;
					ball.speedY *= speedUpFactor;
				}
			}
		});
	}

	checkScoring() {
		const ball = this.gameState.ball;

		// Player 2 scores
		if (ball.x - ball.radius <= -40) {
			this.gameState.score.player2Score++;
			this.resetBall(2);
			const winner = this.checkWin();
			if (winner) {
				return { scored: true, scorer: 2, winner };
			}
			return { scored: true, scorer: 2 };
		}
		// Player 1 scores
		else if (ball.x + ball.radius >= GameConfig.CANVAS_WIDTH + 40) {
			this.gameState.score.player1Score++;
			this.resetBall(1);
			const winner = this.checkWin();
			if (winner) {
				return { scored: true, scorer: 1, winner };
			}
			return { scored: true, scorer: 1 };
		}
		return { scored: false };
	}

	checkWin() {
		const { player1Score, player2Score } = this.gameState.score;
		const maxScore = this.settings.maxScore || GameConfig.DEFAULT_MAX_SCORE;
		if (player1Score >= maxScore || player2Score >= maxScore) {
			return player1Score > player2Score ? 1 : 2;
		}
		return null;
	}

	resetBall(scoringPlayer = null) {
		const ball = this.gameState.ball;
		ball.x = GameConfig.CANVAS_WIDTH / 2;
		ball.y = GameConfig.CANVAS_HEIGHT / 2;
		const angle = Math.random() * (GameConfig.MAX_ANGLE - GameConfig.MIN_ANGLE) + GameConfig.MIN_ANGLE;
		const baseSpeed =
			parseInt(this.settings.ballSpeed) || GameConfig.DEFAULT_BALL_SPEED;
		const speed = baseSpeed * GameConfig.BASE_BALL_SPEED_FACTOR;
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

	cleanup() {
		this.players.forEach((player) => player.close());
		this.players = [];
	}

	getState() {
		return this.gameState;
	}

	updateSettings(newSettings) {
		// Update settings that are passed in and keep the rest the same
		this.settings = {
			...this.settings,
			...newSettings,
		};
		this.gameState.ball.speedX =
			parseInt(newSettings.ballSpeed) * GameConfig.BASE_BALL_SPEED_FACTOR;
		this.gameState.ball.speedY =
			parseInt(newSettings.ballSpeed) * GameConfig.BASE_BALL_SPEED_FACTOR;
		this.gameState.paddle1.speed = parseInt(newSettings.paddleSpeed);
		this.gameState.paddle2.speed = parseInt(newSettings.paddleSpeed);
		this.gameState.paddle1.height = parseInt(newSettings.paddleLength);
		this.gameState.paddle2.height = parseInt(newSettings.paddleLength);

		return this.settings;
	}

	transitionToGame(newGameId) {
		console.log(`Transitioning game from ${this.gameId} to ${newGameId}`);

		// Update the game ID
		const oldGameId = this.gameId;
		this.gameId = newGameId;

		// Update lobby status
		this.isLobby = false;

		// Reset for the actual game
		this.gameState.gameId = newGameId;
		this.gameState.gameStarted = false;

		// Mark both players as ready
		this.playerReadyStatus = new Set([1, 2]);

		console.log(
			`Game successfully transitioned from ${oldGameId} to ${newGameId} with ${this.players.length} players`
		);
		return this;
	}

	resetForRematch() {
		this.gameState.score = { player1Score: 0, player2Score: 0 };
		this.gameState.paddle1.y = (GameConfig.CANVAS_HEIGHT - this.gameState.paddle1.height) / 2;
		this.gameState.paddle2.y = (GameConfig.CANVAS_HEIGHT - this.gameState.paddle2.height) / 2;
		this.gameState.servingPlayer = Math.random() < 0.5 ? 1 : 2;
		this.resetBall();
		this.playerReadyStatus.clear();
		return this;
	}
}

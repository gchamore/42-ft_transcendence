import { createDefaultGameState } from "../../public/dist/shared/types/gameState.js";
import { GameConfig } from "../../public/dist/shared/config/gameConfig.js";
import { safeSend } from '../utils/socketUtils.js';

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

			this.checkWallCollision();

			this.checkPaddleCollision();

			const scoreResult = this.checkScoring(ball);

			return scoreResult;
		}
		return { scored: false };
	}

	checkWallCollision() {
		const ball = this.gameState.ball;
		// Check top wall collision
		if (ball.y - ball.radius <= 0) {
			// Reverse direction
			ball.speedY = Math.abs(ball.speedY);
			// Ensure the ball is outside the wall
			ball.y = ball.radius;
			// Add small random factor to avoid loops
			ball.speedY += (Math.random() - 0.5) * 0.5;
			this.players.forEach((player) => {
				safeSend(player, {
					type: "wallBounce",
					position: { x: ball.x, y: ball.y },
				});
			});
			return true;
		}
		// Check bottom wall collision
		else if (ball.y + ball.radius >= GameConfig.CANVAS_HEIGHT) {
			// Reverse direction
			ball.speedY = -Math.abs(ball.speedY);
			// Ensure the ball is outside the wall
			ball.y = GameConfig.CANVAS_HEIGHT - ball.radius;
			// Add small random factor to avoid loops
			ball.speedY += (Math.random() - 0.5) * 0.5;
			this.players.forEach((player) => {
				safeSend(player, {
					type: "wallBounce",
					position: { x: ball.x, y: ball.y },
				});
			});
			return true;
		}

		return false;
	}

	checkPaddleCollision() {
		const ball = this.gameState.ball;
		[1, 2].forEach((playerNumber) => {
			const paddle = this.gameState[`paddle${playerNumber}`];

			// Calculate the closest point on the paddle to the ball
			const closestX = Math.max(paddle.x, Math.min(ball.x, paddle.x + paddle.width));
			const closestY = Math.max(paddle.y, Math.min(ball.y, paddle.y + paddle.height));

			// Calculate the distance between the ball and this closest point
			const distanceX = ball.x - closestX;
			const distanceY = ball.y - closestY;
			const distanceSquared = distanceX * distanceX + distanceY * distanceY;

			// Check if there's a collision (distance from center to closest point <= radius)
			if (distanceSquared <= ball.radius * ball.radius) {
				// Determine collision side (left/right vs top/bottom)
				const isHorizontalCollision = Math.abs(distanceX) > Math.abs(distanceY);

				// Calculate the current total speed before changes
				const currentSpeed = Math.sqrt(ball.speedX * ball.speedX + ball.speedY * ball.speedY);

				if (isHorizontalCollision) {
					// LEFT/RIGHT COLLISION
					// Flip X direction
					ball.speedX *= -1;

					// Calculate hit position along the paddle (0 = top, 1 = bottom)
					const hitPoint = (ball.y - paddle.y) / paddle.height;

					// Set Y velocity based on where the ball hit the paddle
					ball.speedY = (hitPoint - 0.5) * currentSpeed * 2;

					// Ensure the ball is outside the paddle
					if (playerNumber === 1) {
						ball.x = paddle.x + paddle.width + ball.radius;
					} else {
						ball.x = paddle.x - ball.radius;
					}
				} else {
					// TOP/BOTTOM COLLISION
					// Flip Y direction
					ball.speedY *= -1;

					// Add slight random angle for top/bottom hits to make game more interesting
					ball.speedY += (Math.random() - 0.5) * 0.5;

					// Ensure the ball is outside the paddle
					if (ball.y < paddle.y + paddle.height / 2) {
						ball.y = paddle.y - ball.radius;
					} else {
						ball.y = paddle.y + paddle.height + ball.radius;
					}
				}

				// Scale X velocity to maintain total speed
				const newYSpeed = Math.abs(ball.speedY);
				const newXSpeed = Math.sqrt(currentSpeed * currentSpeed - newYSpeed * newYSpeed);
				ball.speedX = Math.sign(ball.speedX) * newXSpeed;

				// Speed up the ball if below max speed
				const maxSpeed = GameConfig.MAX_BALL_SPEED;
				const speedUpFactor = GameConfig.BALL_SPEEDUP_FACTOR;

				const newSpeed = currentSpeed * speedUpFactor;
				if (newSpeed <= maxSpeed) {
					ball.speedX *= speedUpFactor;
					ball.speedY *= speedUpFactor;
				}
				this.players.forEach((player) => {
					safeSend(player, {
						type: "paddleHit",
						playerNumber,
						ballPosition: { x: ball.x, y: ball.y },
					});
				});
				return;
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

import { createDefaultGameState } from "../../public/dist/shared/types/gameState.js";
import { GameConfig, PowerUpTypes } from "../../public/dist/shared/config/gameConfig.js";
import { safeSend } from '../utils/socketUtils.js';
import { PowerUp } from "./powerUp.js";

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
		this.powerups = [];
		this.activePowerups = [];
		this.nextPowerupId = 1;
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

			if (this.settings.powerUpsEnabled) {
				this.updatePowerups(deltaTime);
				this.checkPowerupCollision();
			}

			this.checkWallCollision();
			this.checkPaddleCollision();
			return (this.checkScoring(ball));
		}
		return { scored: false };
	}

	updatePowerups(deltaTime) {
		const currentTime = Date.now();
		const expiredPowerups = this.activePowerups.filter((powerup) => powerup.isExpired(currentTime));

		if (expiredPowerups.length > 0) {
			expiredPowerups.forEach((powerup) => {
				this.deactivatePowerup(powerup);
			});
			this.activePowerups = this.activePowerups.filter((powerup) => !powerup.isExpired(currentTime));
		}

		const scaledSpawnChance = GameConfig.POWERUP_SPAWN_CHANCE * deltaTime;

		if (this.gameState.gameStarted && this.powerups.length < GameConfig.MAX_ACTIVE_POWERUPS /*&& Math.random() < scaledSpawnChance*/) { //test
			this.spawnPowerup();
		}
	}

	spawnPowerup() {
		const types = Object.values(PowerUpTypes);
		// const type = types[Math.floor(Math.random() * types.length)]; //test
		const type = PowerUpTypes.PADDLE_SLOW; //test
		let x,y;
		let isValidPosition = false;
		while (!isValidPosition) {
			x = Math.random() * (GameConfig.CANVAS_WIDTH - 200) + 100;
			y = Math.random() * (GameConfig.CANVAS_HEIGHT - 100) + 50;

			isValidPosition = this.powerups.every((powerup) => {
				const dx = x - powerup.x;
				const dy = y - powerup.y;
				const distance = Math.sqrt(dx * dx + dy * dy);
				return distance >= GameConfig.POWERUP_SIZE;
			});
		}

		const powerup = new PowerUp(this.nextPowerupId++, type, x, y);
		powerup.radius = GameConfig.POWERUP_SIZE / 2;
		this.powerups.push(powerup);
		this.players.forEach((player) => {
			safeSend(player, {
				type: "powerupSpawn",
				powerup: {
					id: powerup.id,
					type: powerup.type,
					x: powerup.x,
					y: powerup.y,
				},
			});
		});
	}

	checkPowerupCollision() {
		const ball = this.gameState.ball;

		this.powerups.forEach((powerup, index) => {
			const dx = ball.x - powerup.x;
			const dy = ball.y - powerup.y;
			const distance = Math.sqrt(dx * dx + dy * dy);

			if (distance < ball.radius + powerup.radius) {
				const hitByPlayer = ball.speedX > 0 ? 1 : 2;
				this.powerups.splice(index, 1);
				this.activatePowerup(powerup, hitByPlayer);
				this.players.forEach((player) => {
					safeSend(player, {
						type: "powerupCollected",
						powerupId: powerup.id,
						playerNumber: hitByPlayer,
					});
				});
			}
		});
	}

	activatePowerup(powerup, playerNumber) {
		const existingPowerup = this.activePowerups.find(
			(activePowerup) => activePowerup.type === powerup.type && activePowerup.activatedBy === playerNumber);

		if (existingPowerup) {
			existingPowerup.activatedTime = Date.now();
		} else {
			powerup.active = true;
			powerup.activatedBy = playerNumber;
			powerup.activatedTime = Date.now();
			this.activePowerups.push(powerup);
			switch (powerup.type) {
				case PowerUpTypes.PADDLE_GROW:
					this.applyPaddleGrow(playerNumber);
					break;
				case PowerUpTypes.PADDLE_SHRINK:
					this.applyPaddleShrink(playerNumber === 1 ? 2 : 1);
					break;
				case PowerUpTypes.BALL_GROW:
					this.applyBallGrow();
					break;
				case PowerUpTypes.BALL_SHRINK:
					this.applyBallShrink();
					break;
				case PowerUpTypes.PADDLE_SLOW:
					this.applyPaddleSlow(playerNumber === 1 ? 2 : 1);
					break;
			}
		}
	}

	deactivatePowerup(powerup) {
		switch (powerup.type) {
			case PowerUpTypes.PADDLE_GROW:
				this.revertPaddleGrow(powerup.activatedBy);
				break;
			case PowerUpTypes.PADDLE_SHRINK:
				this.revertPaddleShrink(powerup.activatedBy === 1 ? 2 : 1);
				break;
			case PowerUpTypes.BALL_GROW:
			case PowerUpTypes.BALL_SHRINK:
				this.revertBallSize();
				break;
			case PowerUpTypes.PADDLE_SLOW:
				this.revertPaddleSlow(powerup.activatedBy === 1 ? 2 : 1);
				break;
		}

		this.players.forEach((player) => {
			safeSend(player, {
				type: "powerupDeactivated",
				powerupId: powerup.id,
			});
		});
	}

	applyPaddleGrow(playerNumber) {
		const paddle = this.gameState[`paddle${playerNumber}`];
		if (paddle.originalHeight) {
			return;
		}
		paddle.originalHeight = paddle.height;
		paddle.height = Math.min(GameConfig.CANVAS_HEIGHT, paddle.height * 1.5);
		this.clampPaddlePosition(paddle);
	}
	
	revertPaddleGrow(playerNumber) {
		const paddle = this.gameState[`paddle${playerNumber}`];
		if (paddle.originalHeight) {
			paddle.height = paddle.originalHeight;
			delete paddle.originalHeight;
		}
	}

	applyPaddleShrink(playerNumber) {
		const paddle = this.gameState[`paddle${playerNumber}`];
		if (paddle.originalHeight) {
			return;
		}
		paddle.originalHeight = paddle.height;
		paddle.height = Math.max(GameConfig.MIN_PADDLE_LENGTH, paddle.height * 0.5);
		this.clampPaddlePosition(paddle);
	}

	revertPaddleShrink(playerNumber) {
		const paddle = this.gameState[`paddle${playerNumber}`];
		if (paddle.originalHeight) {
			paddle.height = paddle.originalHeight;
			this.clampPaddlePosition(paddle);
			delete paddle.originalHeight;
		}
	}

	applyBallGrow() {
		const ball = this.gameState.ball;
		ball.originalRadius = ball.radius;
		ball.radius = Math.min(GameConfig.MAX_BALL_SIZE, ball.radius * 1.5);
		this.adjustBallPosition();
	}

	applyBallShrink() {
		const ball = this.gameState.ball;
		ball.originalRadius = ball.radius;
		ball.radius = Math.max(GameConfig.MIN_BALL_SIZE, ball.radius * 0.5);
		this.adjustBallPosition();
	}

	adjustBallPosition() {
		const ball = this.gameState.ball;

		if (ball.y < ball.radius)
			ball.y = ball.radius;
		if (ball.y > GameConfig.CANVAS_HEIGHT - ball.radius)
			ball.y = GameConfig.CANVAS_HEIGHT - ball.radius;
		if (ball.x < ball.radius)
			ball.x = ball.radius;
		if (ball.x > GameConfig.CANVAS_WIDTH - ball.radius)
			ball.x = GameConfig.CANVAS_WIDTH - ball.radius;
	}

	revertBallSize() {
		const ball = this.gameState.ball;
		if (ball.originalRadius) {
			ball.radius = ball.originalRadius;
			delete ball.originalRadius;
		}
	}

	applyPaddleSlow(playerNumber) {
		const paddle = this.gameState[`paddle${playerNumber}`];
		paddle.originalSpeed = paddle.speed;
		paddle.speed = Math.max(GameConfig.MIN_PADDLE_SPEED, paddle.speed * 0.5);
	}

	revertPaddleSlow(playerNumber) {
		const paddle = this.gameState[`paddle${playerNumber}`];
		if (paddle.originalSpeed) {
			paddle.speed = paddle.originalSpeed;
			delete paddle.originalSpeed;
		}
	}

	clampPaddlePosition(paddle) {
		const halfHeight = paddle.height / 2;
		paddle.y = Math.max(halfHeight, Math.min(paddle.y, GameConfig.CANVAS_HEIGHT - halfHeight));
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
			const closestY = Math.max(paddle.y - paddle.height / 2, Math.min(ball.y, paddle.y + paddle.height / 2));

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
						ball.x = paddle.x + paddle.width + ball.radius + 1;
					} else {
						ball.x = paddle.x - ball.radius - 1;
					}
				} else {
					// TOP/BOTTOM COLLISION
					// Flip Y direction
					ball.speedY *= -1;

					// Add slight random angle for top/bottom hits to make game more interesting
					ball.speedY += (Math.random() - 0.5) * 0.5;

					// Ensure the ball is outside the paddle
					if (ball.y < paddle.y + paddle.height / 2) {
						ball.y = paddle.y - ball.radius - 1;
					} else {
						ball.y = paddle.y + paddle.height + ball.radius + 1;
					}
				}

				// Scale X velocity to maintain total speed
				const newYSpeed = Math.abs(ball.speedY);
				const valueForSqrt = Math.max(0, currentSpeed * currentSpeed - newYSpeed * newYSpeed);
				const newXSpeed = Math.sqrt(valueForSqrt);
				ball.speedX = Math.sign(ball.speedX) * Math.max(newXSpeed, GameConfig.MIN_BALL_SPEED);

				// Speed up the ball if below max speed
				const maxSpeed = GameConfig.MAX_BALL_SPEED;
				const speedUpFactor = GameConfig.BALL_SPEEDUP_FACTOR;

				const newSpeed = currentSpeed * speedUpFactor;
				if (newSpeed <= maxSpeed) {
					ball.speedX *= speedUpFactor;
					ball.speedY *= speedUpFactor;
				}
				ball.speedY = Math.sign(ball.speedY) * Math.max(Math.abs(ball.speedY),GameConfig.MIN_BALL_SPEED);
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
		if (this.activePowerups.length > 0) {
			const powerupsCopy = [...this.activePowerups];
			powerupsCopy.forEach((powerup) => {
				this.deactivatePowerup(powerup);
			});
			this.activePowerups = [];
		}
		if (this.powerups.length > 0) {
			this.powerups.forEach((powerup) => {
				this.players.forEach((player) => {
					safeSend(player, {
						type: "powerupDeactivated",
						powerupId: powerup.id,
					});
				});
			});
			this.powerups = [];
		}

		const ball = this.gameState.ball;
		if (ball.originalRadius) {
			ball.radius = ball.originalRadius;
			delete ball.originalRadius;
		} else {
			ball.radius = GameConfig.DEFAULT_BALL_RADIUS;
		}

		[1, 2].forEach(playerNumber => {
			const paddle = this.gameState[`paddle${playerNumber}`];
			
			if (paddle.originalHeight) {
				paddle.height = paddle.originalHeight;
				delete paddle.originalHeight;
			}
			
			if (paddle.originalSpeed) {
				paddle.speed = paddle.originalSpeed;
				delete paddle.originalSpeed;
			}
		});

		ball.x = GameConfig.CANVAS_WIDTH / 2;
		ball.y = GameConfig.CANVAS_HEIGHT / 2;
		
		const baseSpeed = parseInt(this.settings.ballSpeed) || GameConfig.DEFAULT_BALL_SPEED;
		const speed = baseSpeed * GameConfig.BASE_BALL_SPEED_FACTOR;

		const angle = Math.random() * (GameConfig.MAX_ANGLE - GameConfig.MIN_ANGLE) + GameConfig.MIN_ANGLE;

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
		this.gameState.ball.speedX = parseInt(newSettings.ballSpeed) * GameConfig.BASE_BALL_SPEED_FACTOR;
		this.gameState.ball.speedY = parseInt(newSettings.ballSpeed) * GameConfig.BASE_BALL_SPEED_FACTOR;
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

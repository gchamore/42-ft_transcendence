import { GameConfig, PowerUpTypes } from '../shared/config/gameConfig.js';
import { safeSend } from '../utils/socketUtils.js';

export class PowerUp {
	constructor(id, type, x, y) {
		this.id = id;
		this.type = type;
		this.x = x;
		this.y = y;
		this.radius = GameConfig.POWERUP_SIZE / 2;
		this.active = false;
		this.activatedBy = null;
		this.activatedTime = null;
		this.duration = GameConfig.POWERUP_DURATION;
	}

	isExpired(currentTime) {
		if (!this.active) return false;
		return currentTime - this.activatedTime >= this.duration;
	}
}

export class PowerUpManager {
	constructor() {
		this.powerups = [];
		this.activePowerups = [];
		this.nextPowerupId = 1;
	}

	updatePowerups(deltaTime, gameState, players) {
		const currentTime = Date.now();

		// Check for expired powerups
		const expiredPowerups = this.activePowerups.filter((powerup) =>
			powerup.isExpired(currentTime)
		);

		if (expiredPowerups.length > 0) {
			expiredPowerups.forEach((powerup) => {
				this.deactivatePowerup(powerup, gameState, players);
			});
			this.activePowerups = this.activePowerups.filter((powerup) =>
				!powerup.isExpired(currentTime)
			);
		}

		// Spawn new powerups
		const scaledSpawnChance = GameConfig.POWERUP_SPAWN_CHANCE * deltaTime;
		if (gameState.gameStarted &&
			this.powerups.length < GameConfig.MAX_ACTIVE_POWERUPS &&
			Math.random() < scaledSpawnChance) {
			this.spawnPowerup(gameState, players);
		}
	}

	spawnPowerup(gameState, players) {
		const types = Object.values(PowerUpTypes);
		const type = types[Math.floor(Math.random() * types.length)];

		let x, y;
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

		players.forEach((player) => {
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

	checkPowerupCollision(gameState, players) {
		const ball = gameState.ball;

		for (let i = 0; i < this.powerups.length; i++) {
			const powerup = this.powerups[i];
			const dx = ball.x - powerup.x;
			const dy = ball.y - powerup.y;
			const distance = Math.sqrt(dx * dx + dy * dy);

			if (distance < ball.radius + powerup.radius) {
				const hitByPlayer = ball.speedX > 0 ? 1 : 2;
				this.powerups.splice(i, 1);
				this.activatePowerup(powerup, hitByPlayer, gameState, players);

				players.forEach((player) => {
					safeSend(player, {
						type: "powerupCollected",
						powerupId: powerup.id,
						playerNumber: hitByPlayer,
					});
				});

				break;
			}
		}
	}

	activatePowerup(powerup, playerNumber, gameState, players) {
		const existingPowerup = this.activePowerups.find(
			(activePowerup) => activePowerup.type === powerup.type &&
				activePowerup.activatedBy === playerNumber
		);

		if (existingPowerup) {
			existingPowerup.activatedTime = Date.now();
		} else {
			powerup.active = true;
			powerup.activatedBy = playerNumber;
			powerup.activatedTime = Date.now();
			this.activePowerups.push(powerup);

			switch (powerup.type) {
				case PowerUpTypes.PADDLE_GROW:
					this.applyPaddleGrow(playerNumber, gameState);
					break;
				case PowerUpTypes.PADDLE_SHRINK:
					this.applyPaddleShrink(playerNumber === 1 ? 2 : 1, gameState);
					break;
				case PowerUpTypes.BALL_GROW:
					this.applyBallGrow(gameState);
					break;
				case PowerUpTypes.BALL_SHRINK:
					this.applyBallShrink(gameState);
					break;
				case PowerUpTypes.PADDLE_SLOW:
					this.applyPaddleSlow(playerNumber === 1 ? 2 : 1, gameState);
					break;
			}
		}
	}

	deactivatePowerup(powerup, gameState, players) {
		switch (powerup.type) {
			case PowerUpTypes.PADDLE_GROW:
				this.revertPaddleGrow(powerup.activatedBy, gameState);
				break;
			case PowerUpTypes.PADDLE_SHRINK:
				this.revertPaddleShrink(powerup.activatedBy === 1 ? 2 : 1, gameState);
				break;
			case PowerUpTypes.BALL_GROW:
			case PowerUpTypes.BALL_SHRINK:
				this.revertBallSize(gameState);
				break;
			case PowerUpTypes.PADDLE_SLOW:
				this.revertPaddleSlow(powerup.activatedBy === 1 ? 2 : 1, gameState);
				break;
		}

		players.forEach((player) => {
			safeSend(player, {
				type: "powerupDeactivated",
				powerupId: powerup.id,
			});
		});
	}

	applyPaddleGrow(playerNumber, gameState) {
		const paddle = gameState[`paddle${playerNumber}`];
		if (paddle.originalHeight) {
			return;
		}
		paddle.originalHeight = paddle.height;
		paddle.height = Math.min(GameConfig.CANVAS_HEIGHT, paddle.height * 1.5);
		this.clampPaddlePosition(paddle);
	}

	revertPaddleGrow(playerNumber, gameState) {
		const paddle = gameState[`paddle${playerNumber}`];
		if (paddle.originalHeight) {
			paddle.height = paddle.originalHeight;
			delete paddle.originalHeight;
		}
	}

	applyPaddleShrink(playerNumber, gameState) {
		const paddle = gameState[`paddle${playerNumber}`];
		if (paddle.originalHeight) {
			return;
		}
		paddle.originalHeight = paddle.height;
		paddle.height = Math.max(GameConfig.MIN_PADDLE_LENGTH, paddle.height * 0.5);
		this.clampPaddlePosition(paddle);
	}

	revertPaddleShrink(playerNumber, gameState) {
		const paddle = gameState[`paddle${playerNumber}`];
		if (paddle.originalHeight) {
			paddle.height = paddle.originalHeight;
			this.clampPaddlePosition(paddle);
			delete paddle.originalHeight;
		}
	}

	applyBallGrow(gameState) {
		const ball = gameState.ball;
		ball.originalRadius = ball.radius;
		ball.radius = Math.min(GameConfig.MAX_BALL_SIZE, ball.radius * 1.5);
		this.adjustBallPosition(gameState);
	}

	applyBallShrink(gameState) {
		const ball = gameState.ball;
		ball.originalRadius = ball.radius;
		ball.radius = Math.max(GameConfig.MIN_BALL_SIZE, ball.radius * 0.5);
		this.adjustBallPosition(gameState);
	}

	adjustBallPosition(gameState) {
		const ball = gameState.ball;

		if (ball.y < ball.radius)
			ball.y = ball.radius;
		if (ball.y > GameConfig.CANVAS_HEIGHT - ball.radius)
			ball.y = GameConfig.CANVAS_HEIGHT - ball.radius;
		if (ball.x < ball.radius)
			ball.x = ball.radius;
		if (ball.x > GameConfig.CANVAS_WIDTH - ball.radius)
			ball.x = GameConfig.CANVAS_WIDTH - ball.radius;
	}

	revertBallSize(gameState) {
		const ball = gameState.ball;
		if (ball.originalRadius) {
			ball.radius = ball.originalRadius;
			delete ball.originalRadius;
		}
	}

	applyPaddleSlow(playerNumber, gameState) {
		const paddle = gameState[`paddle${playerNumber}`];
		paddle.originalSpeed = paddle.speed;
		paddle.speed = Math.max(1, paddle.speed * 0.5);
	}

	revertPaddleSlow(playerNumber, gameState) {
		const paddle = gameState[`paddle${playerNumber}`];
		if (paddle.originalSpeed) {
			paddle.speed = paddle.originalSpeed;
			delete paddle.originalSpeed;
		}
	}

	clampPaddlePosition(paddle) {
		const halfHeight = paddle.height / 2;
		paddle.y = Math.max(halfHeight, Math.min(paddle.y, GameConfig.CANVAS_HEIGHT - halfHeight));
	}

	clearAllPowerups(gameState, players) {
		// Deactivate all active powerups
		if (this.activePowerups.length > 0) {
			const powerupsCopy = [...this.activePowerups];
			powerupsCopy.forEach((powerup) => {
				this.deactivatePowerup(powerup, gameState, players);
			});
			this.activePowerups = [];
		}

		// Remove all powerups on the field
		if (this.powerups.length > 0) {
			this.powerups.forEach((powerup) => {
				players.forEach((player) => {
					safeSend(player, {
						type: "powerupDeactivated",
						powerupId: powerup.id,
					});
				});
			});
			this.powerups = [];
		}
	}
}

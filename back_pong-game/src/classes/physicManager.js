import { GameConfig } from '../../public/dist/shared/config/gameConfig.js';
import { safeSend } from '../utils/socketUtils.js';

export class PhysicManager {
	constructor() { }

	updateBallPosition(ball, deltaTime) {
		ball.x += ball.speedX * deltaTime;
		ball.y += ball.speedY * deltaTime;
	}

	checkWallCollision(ball, players) {
		// Check top wall collision
		if (ball.y - ball.radius <= 0) {
			// Reverse direction
			ball.speedY = Math.abs(ball.speedY);
			// Ensure the ball is outside the wall
			ball.y = ball.radius;
			// Add small random factor to avoid loops
			ball.speedY += (Math.random() - 0.5) * 0.5;
			players.forEach((player) => {
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
			players.forEach((player) => {
				safeSend(player, {
					type: "wallBounce",
					position: { x: ball.x, y: ball.y },
				});
			});
			return true;
		}
		return false;
	}

	checkPaddleCollision(ball, paddle1, paddle2, players) {
		[1, 2].forEach((playerNumber) => {
			const paddle = playerNumber === 1 ? paddle1 : paddle2;

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

					const rawAngle = (hitPoint - 0.5) * Math.PI / 2;
					const constrainedAngle = Math.max(GameConfig.MIN_ANGLE, Math.min(GameConfig.MAX_ANGLE, rawAngle));

					const speedMagnitude = Math.sqrt(ball.speedX * ball.speedX + ball.speedY * ball.speedY);
					ball.speedY = Math.sin(constrainedAngle) * speedMagnitude;
					ball.speedX = Math.sign(ball.speedX) * Math.abs(Math.cos(constrainedAngle) * speedMagnitude);

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
				ball.speedY = Math.sign(ball.speedY) * Math.max(Math.abs(ball.speedY), GameConfig.MIN_BALL_SPEED);

				players.forEach((player) => {
					safeSend(player, {
						type: "paddleHit",
						playerNumber,
						ballPosition: { x: ball.x, y: ball.y },
					});
				});
				return true;
			}
		});
		return false;
	}

	checkScoring(ball, gameState) {
		// Player 2 scores
		if (ball.x - ball.radius <= -40) {
			gameState.score.player2Score++;
			return { scored: true, scorer: 2 };
		}
		// Player 1 scores
		else if (ball.x + ball.radius >= GameConfig.CANVAS_WIDTH + 40) {
			gameState.score.player1Score++;
			return { scored: true, scorer: 1 };
		}
		return { scored: false };
	}

	clampPaddlePosition(paddle) {
		const halfHeight = paddle.height / 2;
		paddle.y = Math.max(halfHeight, Math.min(paddle.y, GameConfig.CANVAS_HEIGHT - halfHeight));
	}
}
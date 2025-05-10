/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   physicManager.js                                   :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: anferre <anferre@student.42.fr>            +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2025/04/28 16:45:49 by anferre           #+#    #+#             */
/*   Updated: 2025/04/28 16:45:53 by anferre          ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

import { GameConfig } from '../shared/config/gameConfig.js';
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
					const relativeIntersectY = (ball.y - paddle.y) / (paddle.height / 2);
					const clamped = Math.max(-1, Math.min(1, relativeIntersectY));
					const angle = clamped * GameConfig.MAX_ANGLE;

					const speed = Math.sqrt(ball.speedX * ball.speedX + ball.speedY * ball.speedY);

					// For left paddle, bounce right; for right paddle, bounce left
					const direction = playerNumber === 1 ? 1 : -1;
					ball.speedX = direction * Math.abs(Math.cos(angle) * speed);
					ball.speedY = Math.sin(angle) * speed;
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
						type: "wallBounce",
						position: { x: ball.x, y: ball.y },
					});
				});
				return true;
			}
		});
		return false;
	}

	checkCustomMapCollision(ball, players) {
		// obstacle positions & half‐sizes from your createCustomMap (width=0.5, depth=3)
		const obstacles = [
			{ x: -3, y: 0, halfW: 0.25, halfH: 1.5 },
			{ x: 3, y: 0, halfW: 0.25, halfH: 1.5 }
		];

		for (const obs of obstacles) {
			// translate into obstacle‐local coords
			const dx = ball.x - obs.x;
			const dy = ball.y - obs.y;

			// find closest point on box to ball center
			const closestX = Math.max(-obs.halfW, Math.min(dx, obs.halfW));
			const closestY = Math.max(-obs.halfH, Math.min(dy, obs.halfH));

			const distX = dx - closestX;
			const distY = dy - closestY;

			if (distX * distX + distY * distY <= ball.radius * ball.radius) {
				// flip X velocity
				ball.speedX *= -1;

				// push the ball outside the obstacle
				if (dx > 0) {
					ball.x = obs.x + obs.halfW + ball.radius + 1;
				} else {
					ball.x = obs.x - obs.halfW - ball.radius - 1;
				}

				// notify clients
				players.forEach(player =>
					safeSend(player, {
						type: "obstacleBounce",
						position: { x: ball.x, y: ball.y }
					})
				);
				return true;
			}
		}

		return false;
	}

	checkScoring(ball, gameState) {
		// Player 2 scores
		if (ball.x - ball.radius <= -40) {
			gameState.score.player2.score++;
			return { scored: true, scorer: 2 };
		}
		// Player 1 scores
		else if (ball.x + ball.radius >= GameConfig.CANVAS_WIDTH + 40) {
			gameState.score.player1.score++;
			return { scored: true, scorer: 1 };
		}
		return { scored: false };
	}

	clampPaddlePosition(paddle) {
		const halfHeight = paddle.height / 2;
		paddle.y = Math.max(halfHeight, Math.min(paddle.y, GameConfig.CANVAS_HEIGHT - halfHeight));
	}
}
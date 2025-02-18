import { Ball } from '../classes/Ball.js';
import { Paddle } from '../classes/Paddle.js';
import { GameConfig } from '../config/GameConfig.js';


export class CollisionManager {
	handleWallCollision(ball: Ball, canvas: HTMLCanvasElement): void {
		// Ball bouncing off top and bottom walls
		if (ball.y - ball.radius <= 0) {
			ball.y = ball.radius;
			ball.speedY = -ball.speedY;
			ball.speedY += (Math.random() - 0.5) * 2;
		} else if (ball.y + ball.radius >= canvas.height) {
			ball.y = canvas.height - ball.radius;
			ball.speedY = -ball.speedY;
			ball.speedY += (Math.random() - 0.5) * 2;
		}
		const minSpeed = Math.sign(ball.speedY) * GameConfig.MIN_VERTICAL_SPEED;
		ball.speedY = Math.sign(ball.speedY) * Math.max(Math.abs(ball.speedY), Math.abs(minSpeed));
	}

	handlePaddleCollision(ball: Ball, paddle: Paddle): void {
		const paddleCenter = paddle.y + paddle.height / 2;
		const hitPosition = (ball.y - paddleCenter) / (paddle.height / 2);
		// max bounce angle is 45 degrees
		const bounceAngle = hitPosition * GameConfig.MAX_ANGLE;
		// calculate new ball speed
		const speed = Math.sqrt(ball.speedX * ball.speedX + ball.speedY * ball.speedY);
		// flip the x speed and adjust the y speed based on the hit position
		ball.speedX = -Math.sign(ball.speedX) * speed * Math.cos(bounceAngle);
		ball.speedY = speed * Math.sin(bounceAngle);
		// apply minimum vertical speed safety check
		if (Math.abs(ball.speedY) < GameConfig.MIN_VERTICAL_SPEED) {
			ball.speedY = Math.sign(ball.speedY) * GameConfig.MIN_VERTICAL_SPEED;
		}
		// add some randomness to the bounce
		ball.speedY += (Math.random() - 0.5);
	}
}
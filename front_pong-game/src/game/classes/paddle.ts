import { GameConfig } from "../../../../shared/config/gameConfig.js";

export class Paddle {
	x: number = 0;
	y: number = 0;
	width: number = GameConfig.DEFAULT_PADDLE_WIDTH;
	height: number = GameConfig.DEFAULT_PADDLE_LENGTH;
	speed: number = GameConfig.DEFAULT_PADDLE_SPEED;
	velocity: number = 0;
	lastProcessedInput: number = 0;

	constructor(x: number, y: number) {
		this.x = x;
		this.width = 10;
		this.height = GameConfig.DEFAULT_PADDLE_LENGTH;
		this.speed = GameConfig.DEFAULT_PADDLE_SPEED;
		this.velocity = 0;
		this.setY(y);
	}

	// Set the center of the paddle
	setY(centerY: number) {
		this.y = centerY - this.height / 2;
	}

	// Update the height of the paddle
	updateHeight(newHeight: number) {
		const centerY = this.y + this.height / 2;
		this.height = newHeight;
		this.setY(centerY);
	}

	move(deltaTime: number = 16.67): void { //default value to 60 fps if not provided
		if (this.velocity !== 0) {
			const scaledVelocity = this.velocity * (deltaTime / 1000) * GameConfig.PADDLE_SPEED_FACTOR;
			this.y -= scaledVelocity;
			this.y = Math.max(this.height / 2, Math.min(this.y, GameConfig.CANVAS_HEIGHT - this.height / 2));
		}
	}
}
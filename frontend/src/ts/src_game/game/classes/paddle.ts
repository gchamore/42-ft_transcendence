import { GameConfig } from "../../../shared/config/gameConfig.js";

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
		this.y = y + this.height / 2;
		this.clampPosition();
	}

	private clampPosition() {
		const halfHeight = this.height / 2;
		this.y = Math.max(halfHeight, Math.min(this.y, GameConfig.CANVAS_HEIGHT - halfHeight));
	}


	// Update the height of the paddle
	update(paddleState: any): void {
		this.height = paddleState.height;
		this.y = paddleState.y;
		this.clampPosition();
	}

	move(deltaTime: number = 16.67): void { //default value to 60 fps if not provided
		if (this.velocity !== 0) {
			const scaledVelocity = this.velocity * (deltaTime / 1000) * GameConfig.PADDLE_SPEED_FACTOR;
			this.y -= scaledVelocity;
			this.clampPosition();
			if (this.y <= this.height / 2 || this.y >= GameConfig.CANVAS_HEIGHT - this.height / 2) {
				this.velocity = 0;
			}
		}
	}
}

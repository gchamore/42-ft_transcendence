export class Paddle {
	x: number = 0;
	y: number = 0;
	width: number = 0;
	height: number = 0;
	speed: number = 0;

	constructor(x: number, y: number, width: number, height: number, speed: number) {
		this.x = x;
		this.width = width;
		this.height = height;
		this.speed = speed;
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

	move(moveUp: boolean, moveDown: boolean, canvasHeight: number): void {
		if (moveUp && this.y > 0) {
			this.y -= this.speed;
		}
		if (moveDown && this.y + this.height < canvasHeight) {
			this.y += this.speed;
		}
	}

	updatePosition(paddleState: { x: number, y: number, height: number }): void {
		this.x = paddleState.x;
		this.y = paddleState.y;
		if (paddleState.height !== this.height)
			this.updateHeight(paddleState.height);
	}
}
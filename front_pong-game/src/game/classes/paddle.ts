export class Paddle {
	x: number = 0;
	y: number = 0;
	width: number = 0;
	height: number = 0;
	speed: number = 0;
	velocity: number = 0;
	lastProcessedInput: number = 0;

	constructor(x: number, y: number) {
		this.x = x;
		this.width = 10;
		this.height = 100;
		this.speed = 5;
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

	move(): void {
		if (this.velocity !== 0) {
			this.y += this.velocity;
			this.y = Math.max(this.height / 2, Math.min(this.y, 600 - this.height / 2));
		}
	}
}
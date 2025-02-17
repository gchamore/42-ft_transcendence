export class Paddle {
	x: number = 0;
	y: number = 0;
	width: number = 0;
	height: number = 0;

	constructor(x: number, y: number, width: number, height: number) {
		this.x = x;
		this.width = width;
		this.height = height;
		this.setY(y);
	}

	// Get the center of the paddle
	getCenterY():number {
		return this.y + this.height / 2;
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
}
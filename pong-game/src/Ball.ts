export class Ball {
	x: number;
	y: number;
	radius: number;
	speedX: number;
	speedY: number;

	constructor(x: number, y: number, radius: number, speed: number) {
		this.x = x;
		this.y = y;
		this.radius = radius;
		this.speedX = speed;
		this.speedY = speed;
	}

	updateSpeed(speed: number) {
		this.speedX = speed;
		this.speedY = speed;
	}
}
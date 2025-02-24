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

	updatePosition(ballState:{x:number, y:number, speedX:number, speedY:number}): void {
		this.x = ballState.x;
		this.y = ballState.y;
		this.speedX = ballState.speedX;
		this.speedY = ballState.speedY;
	}
}
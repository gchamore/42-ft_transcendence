export class Ball {
	x: number;
	y: number;
	radius: number;
	speedX: number;
	speedY: number;

	constructor() {
		this.x = 400;
		this.y = 300;
		this.radius = 10;
		this.speedX = 4;
		this.speedY = 4;
	}

	updatePosition(ballState:{x:number, y:number, speedX:number, speedY:number}): void {
		this.x = ballState.x;
		this.y = ballState.y;
		this.speedX = ballState.speedX;
		this.speedY = ballState.speedY;
	}
}
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

	reset(canvasWidth: number, canvasHeight: number): void {
		this.x = canvasWidth / 2;
		this.y = canvasHeight / 2;
		this.speedX = -this.speedX;
		this.speedY = -this.speedY;
	}

	serve(direction: number, speed: number): void {
		const isStraightServe = Math.random() < 0.3;

		if (isStraightServe) {
			this.speedX = direction * speed;
			this.speedY = 0;
		} else {
			const angle = (Math.random() - 0.5) * (Math.PI / 4); // 45 degrees
			this.speedX = direction * speed * Math.cos(angle);
			this.speedY = speed * Math.sin(angle);
		}
	}
}
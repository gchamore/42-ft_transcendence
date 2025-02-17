export class Ball {
    constructor(x, y, radius, speed) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.speedX = speed;
        this.speedY = speed;
    }
    updateSpeed(speed) {
        this.speedX = speed;
        this.speedY = speed;
    }
}

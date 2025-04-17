import { GameConfig } from "../../../../shared/config/gameConfig.js";
export class Paddle {
    constructor(x, y) {
        this.x = 0;
        this.y = 0;
        this.width = GameConfig.DEFAULT_PADDLE_WIDTH;
        this.height = GameConfig.DEFAULT_PADDLE_LENGTH;
        this.speed = GameConfig.DEFAULT_PADDLE_SPEED;
        this.velocity = 0;
        this.lastProcessedInput = 0;
        this.x = x;
        this.width = 10;
        this.height = GameConfig.DEFAULT_PADDLE_LENGTH;
        this.speed = GameConfig.DEFAULT_PADDLE_SPEED;
        this.velocity = 0;
        this.y = y + this.height / 2;
        this.clampPosition();
    }
    clampPosition() {
        const halfHeight = this.height / 2;
        this.y = Math.max(halfHeight, Math.min(this.y, GameConfig.CANVAS_HEIGHT - halfHeight));
    }
    // Update the height of the paddle
    update(paddleState) {
        this.height = paddleState.height;
        this.y = paddleState.y;
        this.clampPosition();
        console.log('update :', this.y, this.height);
    }
    move(deltaTime = 16.67) {
        if (this.velocity !== 0) {
            const scaledVelocity = this.velocity * (deltaTime / 1000) * GameConfig.PADDLE_SPEED_FACTOR;
            this.y -= scaledVelocity;
            this.clampPosition();
            if (this.y <= this.height / 2 || this.y >= GameConfig.CANVAS_HEIGHT - this.height / 2) {
                this.velocity = 0;
            }
            console.log('move :', this.y, this.height);
        }
    }
}

export class Paddle {
    constructor(x, y, width, height, speed) {
        this.x = 0;
        this.y = 0;
        this.width = 0;
        this.height = 0;
        this.speed = 0;
        this.x = x;
        this.width = width;
        this.height = height;
        this.speed = speed;
        this.setY(y);
    }
    // Set the center of the paddle
    setY(centerY) {
        this.y = centerY - this.height / 2;
    }
    // Update the height of the paddle
    updateHeight(newHeight) {
        const centerY = this.y + this.height / 2;
        this.height = newHeight;
        this.setY(centerY);
    }
    move(moveUp, moveDown, canvasHeight) {
        if (moveUp && this.y > 0) {
            this.y -= this.speed;
        }
        if (moveDown && this.y + this.height < canvasHeight) {
            this.y += this.speed;
        }
    }
    reset() {
        this.y = 0;
    }
}

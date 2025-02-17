export class Paddle {
    constructor(x, y, width, height) {
        this.x = 0;
        this.y = 0;
        this.width = 0;
        this.height = 0;
        this.x = x;
        this.width = width;
        this.height = height;
        this.setY(y);
    }
    // Get the center of the paddle
    getCenterY() {
        return this.y + this.height / 2;
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
}

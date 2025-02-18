export class UIManager {
    constructor(context, canvas) {
        this.context = context;
        this.canvas = canvas;
        this.lastBlink = 0;
        this.showStartMessage = true;
        this.BLINK_INTERVAL = 500;
    }
    drawStartMessage(timestamp, gameStarted) {
        if (!gameStarted) {
            if (timestamp - this.lastBlink > this.BLINK_INTERVAL) {
                this.showStartMessage = !this.showStartMessage;
                this.lastBlink = timestamp;
            }
            if (this.showStartMessage) {
                this.context.fillStyle = "white";
                this.context.font = "20px Arial";
                this.context.textAlign = "center";
                this.context.fillText("Press Space to Start", this.canvas.width / 2, (this.canvas.height / 2) - 50);
            }
        }
    }
}

export class UIManager {
	private lastBlink: number = 0;
	private showStartMessage: boolean = true;
	private readonly BLINK_INTERVAL: number = 500;

	constructor(
		private context: CanvasRenderingContext2D,
		private canvas: HTMLCanvasElement
	) { }

	drawStartMessage(timestamp: number, gameStarted: boolean): void {
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
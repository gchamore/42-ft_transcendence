export class UIManager {
	private lastBlink: number = 0;
	private showStartMessage: boolean = true;
	private readonly BLINK_INTERVAL: number = 500;

	constructor(
		private context: CanvasRenderingContext2D,
		private canvas: HTMLCanvasElement
	) { }

	drawStartMessage(timestamp: number, gameStarted: boolean, playerNumber: number, servingPlayer: number): void {
		if (!gameStarted) {
			if (playerNumber === 1) {
				this.drawWaitingMessage("Waiting for Player 2 to join...");
				return;
			} 
			if (timestamp - this.lastBlink > this.BLINK_INTERVAL) {
				this.showStartMessage = !this.showStartMessage;
				this.lastBlink = timestamp;
			}
			if (this.showStartMessage) {
				if (servingPlayer === playerNumber) {
					this.context.fillStyle = "white";
					this.context.font = "20px Arial";
					this.context.textAlign = "center";
					this.context.fillText("Press Space to Start", this.canvas.width / 2, (this.canvas.height / 2) - 50);
				} else {
					this.drawWaitingMessage('Waiting for the other Player to start...');
				}
			}
		}
	}

	drawErrorMessage(message: string): void {
		this.context.fillStyle = "red";
		this.context.font = "20px Arial";
		this.context.textAlign = "center";
		this.context.fillText(message, this.canvas.width / 2, (this.canvas.height / 2) + 50);
	}

	drawWaitingMessage(message: string): void {
		this.context.fillStyle = "white";
		this.context.font = "20px Arial";
		this.context.textAlign = "center";
		this.context.fillText(message, this.canvas.width / 2, (this.canvas.height / 2) + 50);
	}
}

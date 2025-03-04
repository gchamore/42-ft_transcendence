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

	drawDisconnectionMessage(message: string, isWinner: boolean): void {
		this.context.save();
		this.context.fillStyle = 'rgba(0, 0, 0, 0.7)';
		this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

		this.context.font = '24px Arial';
		this.context.textAlign = 'center';

		if (isWinner) {
			this.context.fillStyle = '#4CAF50';  // Green for winner
			this.context.fillText(message, this.canvas.width / 2, this.canvas.height / 2 - 50);
			this.context.fillText('You win by forfeit!', this.canvas.width / 2, this.canvas.height / 2);
		} else {
			this.context.fillStyle = '#F44336';  // Red for loser
			this.context.fillText(message, this.canvas.width / 2, this.canvas.height / 2 - 50);
			this.context.fillText('You lost the connection', this.canvas.width / 2, this.canvas.height / 2);
		}

		this.context.font = '16px Arial';
		this.context.fillStyle = 'white';
		this.context.fillText('Returning to lobby...', this.canvas.width / 2, this.canvas.height / 2 + 50);
		this.context.restore();
	}

	drawGameOverMessage(timestamp: number, winnerNumber: number, message?: string): void {
		// Create semi-transparent background overlay
		this.context.save();
		this.context.fillStyle = 'rgba(0, 0, 0, 0.7)';
		this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
		
		// Set up text styling
		this.context.font = '36px Arial';
		this.context.textAlign = 'center';
		this.context.fillStyle = '#FFD700'; // Gold color
		
		// Draw the main game over text
		this.context.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 70);
		
		// Draw winner text
		this.context.font = '28px Arial';
		this.context.fillStyle = '#FFFFFF';
		this.context.fillText(`Player ${winnerNumber} wins!`, this.canvas.width / 2, this.canvas.height / 2 - 20);
		
		// Draw the score if provided in the message
		if (message) {
			this.context.font = '24px Arial';
			this.context.fillText(message, this.canvas.width / 2, this.canvas.height / 2 + 30);
		}
		
		// Draw pulsing "Return to lobby" text
		const pulseAmount = Math.sin(timestamp / 300) * 0.2 + 0.8;
		this.context.globalAlpha = pulseAmount;
		this.context.font = '20px Arial';
		this.context.fillStyle = '#4CAF50';
		this.context.fillText('Returning to lobby...', this.canvas.width / 2, this.canvas.height / 2 + 80);
		
		this.context.restore();
	}

	drawWaitingForRematch(timestamp: number): void {
		this.context.save();
		this.context.fillStyle = 'rgba(0, 0, 0, 0.7)';
		this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

		// Set up text styling
		this.context.font = '28px Arial';
		this.context.textAlign = 'center';
		this.context.fillStyle = '#FFFFFF';

		// Draw waiting text
		this.context.fillText('Waiting for opponent...', this.canvas.width / 2, this.canvas.height / 2 - 30);

		// Draw animated dots
		const dots = '.'.repeat(Math.floor((timestamp / 500) % 4));
		this.context.fillText(dots, this.canvas.width / 2, this.canvas.height / 2 + 10);

		this.context.restore();
	}

	clearOverlay(): void {
		const gameOverMenu = document.getElementById('game-over-menu');
		if (gameOverMenu) {
			gameOverMenu.remove();
		}
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}

}

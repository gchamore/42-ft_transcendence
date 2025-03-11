export class ScoreBoard {
	private player1Score: number = 0;
	private player2Score: number = 0;
	private display: HTMLDivElement | null = null;

	// Create a new ScoreBoard instance
	constructor() {
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', () => {
				this.display = this.createScoreDisplay();
			});
		} else {
			this.display = this.createScoreDisplay();
		}
	}

	// Create the score display element
	private createScoreDisplay(): HTMLDivElement {
		try {
			const display = document.createElement('div');
			display.style.position = 'absolute';
			display.style.top = '20px';
			display.style.width = '100%';
			display.style.textAlign = 'center';
			display.style.color = 'white';
			display.style.fontSize = '32px';
			document.body.appendChild(display);
			this.updateDisplay();
			return display;
		} catch (error) {
			console.error('Error creating score display', error);
			throw error;
		}
	}

	updateScore(score: { player1Score: number, player2Score: number }): void {
		this.player1Score = score.player1Score;
		this.player2Score = score.player2Score;
		this.updateDisplay();
	}

	public updateDisplay(): void {
		if (this.display)
			this.display.textContent = `${this.player2Score} - ${this.player1Score}`;
	}
}
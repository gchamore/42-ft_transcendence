export class ScoreBoard {
	private player1Score: number = 0;
	private player2Score: number = 0;
	private display: HTMLDivElement | null = null;

	// Create a new ScoreBoard instance
	constructor() {
		this.display = document.getElementById(
			"score-display"
		) as HTMLDivElement;

		if (!this.display) {
			console.error("Could not find score display element");
		} else {
			this.updateDisplay();
		}
	}

	updateScore(score: { player1Score: number; player2Score: number }): void {
		this.player1Score = score.player1Score;
		this.player2Score = score.player2Score;
		this.updateDisplay();
	}

	public updateDisplay(): void {
		if (this.display)
			this.display.textContent = `${this.player2Score} - ${this.player1Score}`;
	}
}
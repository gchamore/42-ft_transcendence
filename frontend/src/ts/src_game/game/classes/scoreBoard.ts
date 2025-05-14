export class ScoreBoard {
	private player1Score: number = 0;
	private player2Score: number = 0;
	private player1Name: string = "Player1";
	private player2Name: string = "Player2";
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

	updateScore(score: { player1: { name: string, score: number }, player2: { name: string, score: number } }): void {
		this.player1Name = score.player1.name;
		this.player2Name = score.player2.name;
		this.player1Score = score.player1.score;
		this.player2Score = score.player2.score;
		this.updateDisplay();
	}

	public updateDisplay(): void {
		if (this.display)
			this.display.textContent = `${this.player1Name} (${this.player1Score}) - ${this.player2Name} (${this.player2Score})`;
	}
}

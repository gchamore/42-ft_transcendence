export class ScoreBoard {
    private player1Score: number = 0;
    private player2Score: number = 0;
    private display: HTMLDivElement | null = null;
    private readonly winningScore: number;

    constructor(winningScore: number = 5) {
        this.winningScore = winningScore;
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', () => {
				this.display = this.createScoreDisplay();
			});
		} else {
			this.display = this.createScoreDisplay();
		}
    }

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

    private updateDisplay(): void {
		if (this.display)
        	this.display.textContent = `${this.player1Score} - ${this.player2Score}`;
    }

    incrementPlayer1(): void {
        this.player1Score++;
        this.updateDisplay();
    }

    incrementPlayer2(): void {
        this.player2Score++;
        this.updateDisplay();
    }

    reset(): void {
        this.player1Score = 0;
        this.player2Score = 0;
        this.updateDisplay();
    }

    checkWinner(): string | null {
        if (this.player1Score >= this.winningScore) return "Player 1";
        if (this.player2Score >= this.winningScore) return "Player 2";
        return null;
    }
}
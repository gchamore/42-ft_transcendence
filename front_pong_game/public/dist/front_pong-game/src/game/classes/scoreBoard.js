export class ScoreBoard {
    // Create a new ScoreBoard instance
    constructor() {
        this.player1Score = 0;
        this.player2Score = 0;
        this.display = null;
        this.display = document.getElementById("score-display");
        if (!this.display) {
            console.error("Could not find score display element");
        }
        else {
            this.updateDisplay();
        }
    }
    updateScore(score) {
        this.player1Score = score.player1Score;
        this.player2Score = score.player2Score;
        this.updateDisplay();
    }
    updateDisplay() {
        if (this.display)
            this.display.textContent = `${this.player2Score} - ${this.player1Score}`;
    }
}

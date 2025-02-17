export class ScoreBoard {
    constructor(winningScore = 5) {
        this.player1Score = 0;
        this.player2Score = 0;
        this.display = null;
        this.winningScore = winningScore;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.display = this.createScoreDisplay();
            });
        }
        else {
            this.display = this.createScoreDisplay();
        }
    }
    createScoreDisplay() {
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
        }
        catch (error) {
            console.error('Error creating score display', error);
            throw error;
        }
    }
    updateDisplay() {
        if (this.display)
            this.display.textContent = `${this.player1Score} - ${this.player2Score}`;
    }
    incrementPlayer1() {
        this.player1Score++;
        this.updateDisplay();
    }
    incrementPlayer2() {
        this.player2Score++;
        this.updateDisplay();
    }
    reset() {
        this.player1Score = 0;
        this.player2Score = 0;
        this.updateDisplay();
    }
    checkWinner() {
        if (this.player1Score >= this.winningScore)
            return "Player 1";
        if (this.player2Score >= this.winningScore)
            return "Player 2";
        return null;
    }
}

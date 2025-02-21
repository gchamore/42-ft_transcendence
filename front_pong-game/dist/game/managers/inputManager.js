export class InputManager {
    constructor(gameControls, isGameStarted, startGame) {
        this.gameControls = gameControls;
        this.isGameStarted = isGameStarted;
        this.startGame = startGame;
        this.setupEventListeners();
    }
    setupEventListeners() {
        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        window.addEventListener('keyup', this.handleKeyUp.bind(this));
    }
    handleKeyDown(event) {
        if (event.code === 'Space' && !this.isGameStarted()) {
            this.startGame();
        }
        this.gameControls.handleKeyDown(event);
    }
    handleKeyUp(event) {
        this.gameControls.handleKeyUp(event);
    }
    cleanup() {
        window.removeEventListener('keydown', this.handleKeyDown.bind(this));
        window.removeEventListener('keyup', this.handleKeyUp.bind(this));
    }
}

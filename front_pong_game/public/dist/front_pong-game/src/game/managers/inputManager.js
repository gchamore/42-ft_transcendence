export class InputManager {
    constructor(gameControls) {
        this.gameControls = gameControls;
        this.keydownHandler = this.handleKeyDown.bind(this);
        this.keyupHandler = this.handleKeyUp.bind(this);
        this.setupEventListeners();
    }
    handleKeyDown(event) {
        this.gameControls.handleKeyDown(event);
    }
    handleKeyUp(event) {
        this.gameControls.handleKeyUp(event);
    }
    setupEventListeners() {
        window.addEventListener('keydown', this.keydownHandler);
        window.addEventListener('keyup', this.keyupHandler);
    }
    removeEventListeners() {
        window.removeEventListener('keydown', this.keydownHandler);
        window.removeEventListener('keyup', this.keyupHandler);
    }
}

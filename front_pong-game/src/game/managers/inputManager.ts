import { GameControls } from '../classes/gameControls.js';

export class InputManager {

	constructor(
		private gameControls: GameControls,
		private isGameStarted: () => boolean,
	) {
		this.setupEventListeners();
	}

	// Setup event listeners for keydown and keyup events send the changes to the server
	private setupEventListeners(): void {
		window.addEventListener('keydown', (event) => {
			if (!this.isGameStarted()) {
				this.gameControls.handleKeyDown(event);
				return;
			}
			this.gameControls.handleKeyDown(event);
		});

		window.addEventListener('keyup', (event) => {
			if (!this.isGameStarted()) return;
			this.gameControls.handleKeyUp(event);
		});

		window.addEventListener('beforeunload', () => {
			this.gameControls.handleDisconnect();
		});
	}

	removeEventListeners(): void {
		window.removeEventListener('keydown', this.gameControls.handleKeyDown);
		window.removeEventListener('keyup', this.gameControls.handleKeyUp);
	}
}
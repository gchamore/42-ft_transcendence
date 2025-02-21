import { GameControls } from '../classes/gameControls.js';

export class InputManager {

	constructor(
		private gameControls: GameControls,
		private isGameStarted: () => boolean,
		private startGame: () => void
	) {
		this.setupEventListeners();
	}

	private setupEventListeners(): void {
		window.addEventListener('keydown', this.handleKeyDown.bind(this));
		window.addEventListener('keyup', this.handleKeyUp.bind(this));
	}

	private handleKeyDown(event: KeyboardEvent): void {
		if (event.code === 'Space' && !this.isGameStarted()) {
			this.startGame();
		}
		this.gameControls.handleKeyDown(event);
	}

	private handleKeyUp(event: KeyboardEvent): void {
		this.gameControls.handleKeyUp(event);
	}

	public cleanup(): void {
		window.removeEventListener('keydown', this.handleKeyDown.bind(this));
		window.removeEventListener('keyup', this.handleKeyUp.bind(this));
	}
}
import { GameControls } from '../classes/gameControls.js';

export class InputManager {
	private keydownHandler: (event: KeyboardEvent) => void;
	private keyupHandler: (event: KeyboardEvent) => void;

	constructor(
		private gameControls: GameControls,
	) {
		this.keydownHandler = this.handleKeyDown.bind(this);
		this.keyupHandler = this.handleKeyUp.bind(this);
		this.setupEventListeners();
	}

	private handleKeyDown(event: KeyboardEvent): void {
		this.gameControls.handleKeyDown(event);
	}

	private handleKeyUp(event: KeyboardEvent): void {
		this.gameControls.handleKeyUp(event);
	}

	private setupEventListeners(): void {
		window.addEventListener('keydown', this.keydownHandler);
		window.addEventListener('keyup', this.keyupHandler);
	}

	removeEventListeners(): void {
		window.removeEventListener('keydown', this.keydownHandler);
		window.removeEventListener('keyup', this.keyupHandler);
	}
}
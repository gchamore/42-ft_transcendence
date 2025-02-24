import { GameControls } from '../classes/gameControls.js';

export class InputManager {

	private socket!: WebSocket;

	constructor(
		private gameControls: GameControls,
		private isGameStarted: () => boolean,
		socket: WebSocket
	) {
		this.setupEventListeners();
		this.socket = socket;
	}

	// Setup event listeners for keydown and keyup events send the changes to the server
	private setupEventListeners(): void {
		window.addEventListener('keydown', (event) => {
			if (event.key === ' ') {
				this.sendStartGame();
			}
			if (!this.isGameStarted()) return;
			this.gameControls.handleKeyDown(event);
		});

		window.addEventListener('keyup', (event) => {
			if (!this.isGameStarted()) return;
			this.gameControls.handleKeyUp(event);
		});
	}

	sendStartGame() {
		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			this.socket.send(JSON.stringify({ type: 'startGame' }));
		}
	}

	removeEventListeners(): void {
		window.removeEventListener('keydown', this.gameControls.handleKeyDown);
		window.removeEventListener('keyup', this.gameControls.handleKeyUp);
	}
}
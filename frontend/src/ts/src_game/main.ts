import { SettingsPage } from './pages/settingsPage.js';
import { Game } from './pages/gamePage.js';
import { WebSocketService } from './services/webSocketService.js';

class App {
	private readonly DEFAULT_MODE = 'lobby';
	private readonly GAME_MODE = 'game';

	private currentSettingsPage: SettingsPage | null = null;
	private currentGamePage: Game | null = null;
	private webSocketService: WebSocketService;

	constructor() {
		this.webSocketService = WebSocketService.getInstance();
		this.setupRouting().catch(error => {
			console.error('Failed to setup routing:', error);
			this.navigateToDefault();
		});
	}


	async setupRouting() {
		const urlParams = new URLSearchParams(window.location.search);
		const mode = urlParams.get('mode') || this.DEFAULT_MODE;
		const gameId = window.location.pathname.split('/')[2];

		const settingsPage = document.getElementById('settings-page');
		const gamePage = document.getElementById('gameCanvas');
		const gameContainer = document.getElementById('game-container');
		const fpsCounter = document.getElementById('fps-counter');

		if (!settingsPage || !gamePage || !gameContainer || !fpsCounter) {
			console.error('Required elements are not available in the DOM!');
			return; // Prevent errors if elements are not found
		}

		if (this.currentSettingsPage) {
			this.currentSettingsPage.cleanup();
			this.currentSettingsPage = null;
		}
		if (this.currentGamePage) {
			this.currentGamePage.stopGame();
			this.currentGamePage = null;
		}


		if (!gameId) {
			try {
				const response = await fetch('/game/create', { method: 'POST' });
				if (!response.ok) {
					throw new Error('Failed to create game');
				}
				const data = await response.json();
				const newGameId = data.gameId;
				window.history.replaceState({}, '', `/game/${newGameId}?mode=${this.DEFAULT_MODE}`);
				return this.setupRouting();
			} catch (error) {
				console.error('Failed to generate unique gameId:', error);
				this.navigateToDefault();
				return;
			}
		}

		if (mode === this.GAME_MODE) {
			this.currentGamePage = new Game(gameId);
			settingsPage!.style.display = 'none'; // Hide settings page
			gameContainer.style.display = 'block'; // Show game container
			gamePage!.style.display = 'block'; // Show game page
			fpsCounter!.style.display = 'block'; // Show FPS counter
		} else if (mode === this.DEFAULT_MODE) {
			this.currentSettingsPage = new SettingsPage(gameId); // store reference to settings page
			settingsPage!.style.display = 'block'; // Show settings page
			gamePage!.style.display = 'none'; // Hide game page
			gameContainer.style.display = 'none'; // Hide game container
		} else {
			console.error('Invalid route:', mode);
			this.navigateToDefault();
		}

		window.addEventListener('hashchange', () => {
			this.setupRouting();
		});
	}

	private navigateToDefault() {
		window.history.replaceState({}, '', `/game?mode=${this.DEFAULT_MODE}`);
		this.setupRouting();
	}

	public cleanup() {
		if (this.currentSettingsPage) {
			this.currentSettingsPage.cleanup();
			this.currentSettingsPage = null;
		}
		if (this.currentGamePage) {
			this.currentGamePage.stopGame();
			this.currentGamePage = null;
		}
		this.webSocketService.close();
	}
}

// Initialize SPA
const app = new App();

window.addEventListener('beforeunload', () => {
	app.cleanup();
});

window.addEventListener('error', (event) => {
	console.error('Unhandled error:', event.error);
});

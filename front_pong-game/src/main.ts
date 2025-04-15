import { SettingsPage } from './pages/settingsPage.js';
import { Game } from './pages/gamePage.js';
import { WebSocketService } from './services/webSocketService.js';

class App {
	private readonly DEFAULT_ROUTE = 'settings';
	private readonly GAME_ROUTE = 'game';

	private currentSettingsPage: SettingsPage | null = null;
	private currentGamePage: Game | null = null;
	private hashChangeListener: () => void;
	private webSocketService: WebSocketService;

	constructor() {
		this.webSocketService = WebSocketService.getInstance();
		this.hashChangeListener = this.setupRouting.bind(this);
		window.addEventListener('hashchange', this.hashChangeListener);
		this.setupRouting().catch(error => {
			console.error('Failed to setup routing:', error);
			window.location.hash = this.DEFAULT_ROUTE;
		});
	}


	async setupRouting() {
		const path = window.location.hash || this.DEFAULT_ROUTE;
		const [page, gameId] = path.split('/');

		const settingsPage = document.getElementById('settings-page');
		const gamePage = document.getElementById('gameCanvas');
		const gameContainer = document.getElementById('game-container');

		if (!settingsPage || !gamePage || !gameContainer) {
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

		let activeGameId = gameId;

		if (page === this.GAME_ROUTE) {
			try {
				// Generate random gameId if none provided
				// Update URL with gameId
				if (!gameId) {
					const response = await fetch('/game/create', { method: 'POST' });
					if (!response.ok) {
						throw new Error('Failed to create game');
					}
					const data = await response.json();
					activeGameId = data.gameId;
					window.location.hash = `game/${activeGameId}`; // Update URL with new gameId\
					return;
				}
				this.currentGamePage = new Game(activeGameId);
				settingsPage!.style.display = 'none'; // Hide settings page
				gameContainer.style.display = 'block'; // Show game container
				gamePage!.style.display = 'block'; // Show game page
			} catch (error) {
				console.error('Failed to generate unique gameId:', error);
				// Handle error (maybe redirect to error page or settings)
				window.location.hash = this.DEFAULT_ROUTE;
			}
		} else {
			this.currentSettingsPage = new SettingsPage(activeGameId); // store reference to settings page
			settingsPage!.style.display = 'block'; // Show settings page
			gamePage!.style.display = 'none'; // Hide game page
			gameContainer.style.display = 'none'; // Hide game container
		}

		window.addEventListener('hashchange', () => {
		   this.setupRouting();
		});
	}

	public cleanup() {
		window.removeEventListener('hashchange', this.hashChangeListener);
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

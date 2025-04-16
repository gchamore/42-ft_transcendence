import { SettingsPage } from './pages/settingsPage.js';
import { Game } from './pages/gamePage.js';
import { WebSocketService } from './services/webSocketService.js';

class App {
	private readonly DEFAULT_ROUTE = 'lobby';
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
		const rawPath = window.location.hash || this.DEFAULT_ROUTE;
		const path = rawPath.startsWith('#') ? rawPath.substring(1) : rawPath;
		let [page, gameId] = path.split('/');

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

		
		if (!gameId) {
			try { 
				const response = await fetch('/game/create', { method: 'POST' });
				if (!response.ok) {
					throw new Error('Failed to create game');
				}
				const data = await response.json();
				gameId = data.gameId;
				window.location.hash = `${this.DEFAULT_ROUTE}/${gameId}`;
				return;
			} catch (error) {
				console.error('Failed to generate unique gameId:', error);
				window.location.hash = this.DEFAULT_ROUTE;
				return;
			}
		}

		if (page === this.GAME_ROUTE) {
			this.currentGamePage = new Game(gameId);
			settingsPage!.style.display = 'none'; // Hide settings page
			gameContainer.style.display = 'block'; // Show game container
			gamePage!.style.display = 'block'; // Show game page
		} else if (page === this.DEFAULT_ROUTE) {
			this.currentSettingsPage = new SettingsPage(gameId); // store reference to settings page
			settingsPage!.style.display = 'block'; // Show settings page
			gamePage!.style.display = 'none'; // Hide game page
			gameContainer.style.display = 'none'; // Hide game container
		} else {
			console.error('Invalid route:', path);
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

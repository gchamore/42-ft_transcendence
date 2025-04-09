import { SettingsPage } from './pages/settingsPage.js';
import { Game } from './pages/gamePage.js';
import { WebSocketService } from './services/webSocketService.js';
import { GameConfig } from '../../shared/config/gameConfig.js';

class App {
	private readonly DEFAULT_ROUTE = '#settings';
	private readonly GAME_ROUTE = '#game';
	private readonly MAX_ID_ATTEMPTS = 10;

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

		if (page === this.GAME_ROUTE) {
			try {
				// Generate random gameId if none provided
				const activeGameId = gameId || await this.generateGameId();
				// Update URL with gameId
				if (!gameId) {
					window.location.hash = `#game/${activeGameId}`;
					return; // Wait for hash change event to re-run setupRouting
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
			this.currentSettingsPage = new SettingsPage(); // store reference to settings page
			settingsPage!.style.display = 'block'; // Show settings page
			gamePage!.style.display = 'none'; // Hide game page
			gameContainer.style.display = 'none'; // Hide game container
		}

		window.addEventListener('hashchange', () => {
		   this.setupRouting();
		});
	}
	
	// Generate a random gameId that doesn't already exist
	private async generateGameId(): Promise<string> {
		let attempts = 0;
		
		while (attempts < this.MAX_ID_ATTEMPTS) {
			const gameId = Math.random().toString(36).substring(2, 8);
			const ipAddress = GameConfig.IP_ADDRESS;
			
			try {
				// Check if game exists by trying to fetch its status
				const response = await fetch(`http://${ipAddress}:3000/game/status/${gameId}`);
				if (response.status === 404) {
					// Game doesn't exist, we can use this ID
					return gameId;
				}
			} catch (error) {
				console.error('Error checking gameId:', error);
			}
			attempts++;
		}
		
		throw new Error('Could not generate unique gameId after maximum attempts');
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

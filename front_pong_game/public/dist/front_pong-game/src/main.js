var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { SettingsPage } from './pages/settingsPage.js';
import { Game } from './pages/gamePage.js';
import { WebSocketService } from './services/webSocketService.js';
class App {
    constructor() {
        this.DEFAULT_ROUTE = 'lobby';
        this.GAME_ROUTE = 'game';
        this.currentSettingsPage = null;
        this.currentGamePage = null;
        this.webSocketService = WebSocketService.getInstance();
        this.hashChangeListener = this.setupRouting.bind(this);
        window.addEventListener('hashchange', this.hashChangeListener);
        this.setupRouting().catch(error => {
            console.error('Failed to setup routing:', error);
            window.location.hash = this.DEFAULT_ROUTE;
        });
    }
    setupRouting() {
        return __awaiter(this, void 0, void 0, function* () {
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
                    const response = yield fetch('/game/create', { method: 'POST' });
                    if (!response.ok) {
                        throw new Error('Failed to create game');
                    }
                    const data = yield response.json();
                    gameId = data.gameId;
                    window.location.hash = `${this.DEFAULT_ROUTE}/${gameId}`;
                    return;
                }
                catch (error) {
                    console.error('Failed to generate unique gameId:', error);
                    window.location.hash = this.DEFAULT_ROUTE;
                    return;
                }
            }
            if (page === this.GAME_ROUTE) {
                this.currentGamePage = new Game(gameId);
                settingsPage.style.display = 'none'; // Hide settings page
                gameContainer.style.display = 'block'; // Show game container
                gamePage.style.display = 'block'; // Show game page
            }
            else if (page === this.DEFAULT_ROUTE) {
                this.currentSettingsPage = new SettingsPage(gameId); // store reference to settings page
                settingsPage.style.display = 'block'; // Show settings page
                gamePage.style.display = 'none'; // Hide game page
                gameContainer.style.display = 'none'; // Hide game container
            }
            else {
                console.error('Invalid route:', path);
            }
            window.addEventListener('hashchange', () => {
                this.setupRouting();
            });
        });
    }
    cleanup() {
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

import { SettingsPage } from './pages/settingsPage.js';
import { Game } from './pages/gamePage.js';
class App {
    constructor() {
        this.setupRouting();
    }
    setupRouting() {
        const hash = window.location.hash || '#settings';
        const settingsPage = document.getElementById('settings-page');
        const gamePage = document.getElementById('gameCanvas');
        if (!settingsPage || !gamePage) {
            console.error('Required elements are not available in the DOM!');
            return; // Prevent errors if elements are not found
        }
        if (hash === '#game') {
            new Game(); // Load game page
            settingsPage.style.display = 'none'; // Hide settings page
            gamePage.style.display = 'block'; // Show game page
        }
        else {
            new SettingsPage(); // Load settings page
            settingsPage.style.display = 'block'; // Show settings page
            gamePage.style.display = 'none'; // Hide game page
        }
        window.addEventListener('hashchange', () => {
            this.setupRouting();
        });
    }
}
// Initialize SPA
new App();

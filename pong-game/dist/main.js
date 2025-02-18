import { SettingsPage } from './pages/settingsPage';
import { Game } from './pages/gamePage';
class App {
    constructor() {
        this.setupRouting();
    }
    setupRouting() {
        const hash = window.location.hash || '#settings';
        if (hash === '#game') {
            new Game(); // Load game page
        }
        else {
            new SettingsPage(); // Load settings page
        }
    }
}
// Initialize SPA
new App();

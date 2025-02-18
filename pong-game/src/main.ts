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
            document.getElementById('settings-page')!.style.display = 'none'; // Hide settings page
            document.getElementById('game-page')!.style.display = 'block'; // Show game page
        } else {
            new SettingsPage(); // Load settings page
            document.getElementById('settings-page')!.style.display = 'block'; // Show settings page
            document.getElementById('game-page')!.style.display = 'none'; // Hide game page
        }

        window.addEventListener('hashchange', () => {
           this.setupRouting();
        });
    }
}

// Initialize SPA
new App();
import { Game } from './Game.js';
document.addEventListener('DOMContentLoaded', () => {
    try {
        const game = new Game();
        game.start();
    }
    catch (error) {
        console.error(error);
    }
});

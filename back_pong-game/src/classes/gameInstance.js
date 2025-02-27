import { createDefaultGameState } from '../../public/dist/shared/types/gameState.js';

export class GameInstance {
	constructor(gameId) {
		this.gameId = gameId;
		this.players = [];
		this.gameState = createDefaultGameState();
		this.settings = {
			ballSpeed: 4,
			paddleSpeed: 4,
			paddleLength: 100,
			mapType: 'default',
			powerUps: false,
		};
	}

	addPlayer(socket) {
		if (this.players.length >= 2) {
			return false;
		}
		const playerNumber = this.players.length + 1;
		socket.playerNumber = playerNumber;
		this.players.push(socket);
		return true;
	}

	removePlayer(socket) {
		const index = this.players.indexOf(socket);
		if (index > -1) {
			this.players.splice(index, 1);
		}
		if (this.players.length === 0) {
			this.reset();
		}
	}

	reset() {
		this.gameState = createDefaultGameState();
	}

	updatePaddlePosition(playerNumber, y) {
		if (playerNumber === 1) {
			this.gameState.paddle1.y = y;
		} else {
			this.gameState.paddle2.y = y;
		}
	}

	updateBall(x, y) {
		this.gameState.ball.x = x;
		this.gameState.ball.y = y;
	}

	updateScore(player) {
		if (player === 1) {
			this.gameState.score.player1Score++;
		} else {
			this.gameState.score.player2Score++;
		}
	}

	cleanup() {
		this.players.forEach(player => player.close());
		this.players = [];
	}

	getState() {
		return this.gameState;
	}

	updateSettings(newSettings) {
		// Update settings that are passed in and keep the rest the same
		this.settings = {
            ...this.settings,
            ...newSettings
        };
		this.gameState.ball.speedX = parseInt(newSettings.ballSpeed);
		this.gameState.ball.speedY = parseInt(newSettings.ballSpeed);
		this.gameState.paddle1.speed = parseInt(newSettings.paddleSpeed);
		this.gameState.paddle2.speed = parseInt(newSettings.paddleSpeed);
		this.gameState.paddle1.height = parseInt(newSettings.paddleLength);
		this.gameState.paddle2.height = parseInt(newSettings.paddleLength);

		return this.settings;
	}
	
}
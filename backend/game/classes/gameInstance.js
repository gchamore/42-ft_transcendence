import { GameStateManager } from './gameStateManager.js';
import { PhysicManager } from './physicManager.js';
import { PowerUpManager } from './powerUp.js';

export class GameInstance {
	constructor(gameId, existingSettings) {
		this.gameId = gameId;
		this.players = new Map();
		this.gameStateManager = new GameStateManager(gameId, existingSettings);
		this.physicManager = new PhysicManager();
		this.powerUpManager = new PowerUpManager();
		this.settings = existingSettings;

		this.playerReadyStatus = this.gameStateManager.playerReadyStatus;

		// Reset ball position
		this.resetBall();
	}

	setPlayerReady(playerNumber) {
		return this.gameStateManager.setPlayerReady(playerNumber);
	}

	isGameReady() {
		return this.gameStateManager.isGameReady();
	}

	addPlayer(socket) {
		if (this.players.size >= 2) {
			console.error(`Game ${this.gameId} is full length : ${this.players.size}`);
			return false;
		}

		if (!socket) {
			console.error('Socket is null or undefined');
			return false;
		}
		const cliendId = socket.clientId;
		if (!cliendId) {
			console.error('Socket does not have a clientId');
			return false;
		}

		const playerNumber = socket.playerNumber;
		if (!playerNumber) {
			console.error('Socket does not have a playerNumber');
			return false;
		}

		if (!this.players.has(cliendId)) {
			this.players.set(cliendId, socket);
		}
		return true;
	}

	removePlayer(socket) {
		const clientId = socket.clientId;
		if (!clientId) {
			console.error('Socket does not have a clientId');
			return;
		}

		this.players.delete(clientId);
		console.log(`Player ${socket.playerNumber} (Client ${clientId}) removed from game ${this.gameId}`);

		if (this.players.size === 0) {
			this.cleanup();
		}
	}

	update(deltaTime) {
		const gameState = this.gameStateManager.getState();
		const ball = this.gameState.ball;

		if (gameState.gameStarted) {
			// Update ball position
			this.physicManager.updateBallPosition(ball, deltaTime);

			// Handle powerups if enabled
			if (this.settings.powerUpsEnabled) {
				this.powerUpManager.updatePowerups(deltaTime, gameState, this.players);
				this.powerUpManager.checkPowerupCollision(gameState, this.players);
			}

			// Check collisions
			this.physicManager.checkWallCollision(ball,  this.players.values());
			this.physicManager.checkPaddleCollision(ball, gameState.paddle1, gameState.paddle2, this.players);

			// Check if someone scored
			const scoringResult = this.physicManager.checkScoring(ball, gameState);

			if (scoringResult.scored) {
				this.resetBall(scoringResult.scorer);

				// Check for game winner
				const winner = gameStateManager.checkWin();
				if (winner) {
					scoringResult.winner = winner;
				}
			}

			return scoringResult;
		}
		return { scored: false };
	}

	resetBall(scoringPlayer = null) {
		// Clear all powerups first
		const gameState = this.gameStateManager.getState();
		if (this.settings.powerUpsEnabled) {
			this.powerUpManager.clearAllPowerups(gameState,  this.players);
		}

		// Reset ball position and speed
		this.gameStateManager.resetBall(scoringPlayer);
	}

	updateSettings(newSettings) {
		this.settings = { ...this.settings, ...newSettings };
		return this.settings;
	}

	resetForRematch() {
		this.gameStateManager.resetForRematch();
		return this;
	}

	cleanup() {
		//stocker donnees de game avant de clean 
		this.players.forEach((player) => player.close());
		this.players.clear();
	}

	getState() {
		return this.gameStateManager.getState();
	}
}
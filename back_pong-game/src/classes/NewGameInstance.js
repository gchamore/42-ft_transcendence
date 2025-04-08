import { GameStateManager } from './gameStateManager.js';
import { PhysicManager } from './physicManager.js';
import { PowerUpManager } from './powerUp.js';
import { safeSend } from '../utils/socketUtils.js';

export class GameInstance {
  constructor(gameId, existingSettings = null) {
    this.gameId = gameId;
    this.players = [];
    this.gameStateManager = new GameStateManager(gameId, existingSettings);
    this.physicManager = new PhysicManager();
    this.powerUpManager = new PowerUpManager();
    
    // Initialize game state
    this.gameState = this.gameStateManager.getState();
    this.settings = this.gameStateManager.settings;
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
    this.gameStateManager.reset();
    this.gameState = this.gameStateManager.getState();
  }

  update(deltaTime) {
    this.gameState = this.gameStateManager.getState();
    const ball = this.gameState.ball;

    if (this.gameState.gameStarted) {
      // Update ball position
      this.physicManager.updateBallPosition(ball, deltaTime);

      // Handle powerups if enabled
      if (this.settings.powerUpsEnabled) {
        this.powerUpManager.updatePowerups(deltaTime, this.gameState, this.players);
        this.powerUpManager.checkPowerupCollision(this.gameState, this.players);
      }

      // Check collisions
      this.physicManager.checkWallCollision(ball, this.players);
      this.physicManager.checkPaddleCollision(ball, this.gameState.paddle1, this.gameState.paddle2, this.players);
      
      // Check if someone scored
      const scoringResult = this.physicManager.checkScoring(ball, this.gameState);
      
      if (scoringResult.scored) {
        this.resetBall(scoringResult.scorer);
        
        // Check for game winner
        const winner = this.gameStateManager.checkWin();
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
    if (this.settings.powerUpsEnabled) {
      this.powerUpManager.clearAllPowerups(this.gameState, this.players);
    }
    
    // Reset ball position and speed
    this.gameStateManager.resetBall(scoringPlayer);
  }

  updateSettings(newSettings) {
    return this.gameStateManager.updateSettings(newSettings);
  }

  transitionToGame(newGameId) {
    this.gameStateManager.transitionToGame(newGameId);
    this.gameState = this.gameStateManager.getState();
    this.gameId = this.gameStateManager.gameId;
    this.isLobby = this.gameStateManager.isLobby;
    return this;
  }

  resetForRematch() {
    this.gameStateManager.resetForRematch();
    this.gameState = this.gameStateManager.getState();
    return this;
  }

  cleanup() {
    this.players.forEach((player) => player.close());
    this.players = [];
  }

  getState() {
    return this.gameState;
  }
}
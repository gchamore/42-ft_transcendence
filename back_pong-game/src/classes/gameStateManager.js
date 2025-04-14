import { createDefaultGameState } from "../../public/dist/shared/types/gameState.js";
import { GameConfig } from "../../public/dist/shared/config/gameConfig.js";
import { safeSend } from '../utils/socketUtils.js';

export class GameStateManager {
	constructor(gameId, settings) {
		this.gameId = gameId;
		this.isLobby = gameId.startsWith("lobby-");
		this.gameState = createDefaultGameState(gameId);
		this.playerReadyStatus = new Set();
		this.settings = settings;
	}

	setPlayerReady(playerNumber) {
		this.playerReadyStatus.add(playerNumber);
		return this.playerReadyStatus.size === 2;
	}

	isGameReady() {
		return this.playerReadyStatus.size === 2;
	}

	resetBall(scoringPlayer = null) {
		const ball = this.gameState.ball;

		if (ball.originalRadius) {
			ball.radius = ball.originalRadius;
			delete ball.originalRadius;
		} else {
			ball.radius = GameConfig.DEFAULT_BALL_RADIUS;
		}

		// Reset paddles to original state
		[1, 2].forEach(playerNumber => {
			const paddle = this.gameState[`paddle${playerNumber}`];

			if (paddle.originalHeight) {
				paddle.height = paddle.originalHeight;
				delete paddle.originalHeight;
			}

			if (paddle.originalSpeed) {
				paddle.speed = paddle.originalSpeed;
				delete paddle.originalSpeed;
			}
		});

		// Position ball in center
		ball.x = GameConfig.CANVAS_WIDTH / 2;
		ball.y = GameConfig.CANVAS_HEIGHT / 2;

		// Set ball speed and direction
		const baseSpeed = parseInt(this.settings.ballSpeed) || GameConfig.DEFAULT_BALL_SPEED;
		const speed = baseSpeed * GameConfig.BASE_BALL_SPEED_FACTOR;

		const angle = Math.random() * (GameConfig.MAX_ANGLE - GameConfig.MIN_ANGLE) + GameConfig.MIN_ANGLE;

		if (scoringPlayer) {
			ball.speedX = scoringPlayer === 1 ? speed : -speed;
			this.gameState.servingPlayer = scoringPlayer === 1 ? 2 : 1;
		} else {
			// Initial serve - random direction
			ball.speedX = Math.random() > 0.5 ? speed : -speed;
		}

		// Apply the angle
		ball.speedY = Math.sin(angle) * speed;

		// Ensure the game is paused after reset
		this.gameState.gameStarted = false;
	}

	checkWin() {
		const { player1Score, player2Score } = this.gameState.score;
		const maxScore = this.settings.maxScore || GameConfig.DEFAULT_MAX_SCORE;
		if (player1Score >= maxScore || player2Score >= maxScore) {
			return player1Score > player2Score ? 1 : 2;
		}
		return null;
	}

	transitionToGame(newGameId) {

		// Update the game ID
		const oldGameId = this.gameId;
		this.gameId = newGameId;

		// Update lobby status
		this.isLobby = false;

		// Reset for the actual game
		this.gameState.gameId = newGameId;
		this.gameState.gameStarted = false;

		// Mark both players as ready
		this.playerReadyStatus = new Set([1, 2]);

		return this;
	}

	resetForRematch() {
		this.gameState.score = { player1Score: 0, player2Score: 0 };
		this.gameState.paddle1.y = (GameConfig.CANVAS_HEIGHT - this.gameState.paddle1.height) / 2;
		this.gameState.paddle2.y = (GameConfig.CANVAS_HEIGHT - this.gameState.paddle2.height) / 2;
		this.gameState.servingPlayer = Math.random() < 0.5 ? 1 : 2;
		this.resetBall();
		this.playerReadyStatus.clear();
		return this;
	}

	reset() {
		this.gameState = createDefaultGameState(this.gameId);
	}

	getState() {
		return this.gameState;
	}
}
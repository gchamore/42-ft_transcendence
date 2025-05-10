import { createDefaultGameState } from "../shared/types/gameState.js";
import { GameConfig } from "../shared/config/gameConfig.js";

export class GameStateManager {
	constructor(gameId, settings) {
		this.gameId = gameId;
		this.gameState = createDefaultGameState(gameId);
		this.playerReadyStatus = new Set();
		this.settings = settings;
		this.applySettings(this.gameState, settings);
	}

	applySettings(gameState, settings) {
		gameState.ball.speedX = Number(settings.ballSpeed) || GameConfig.DEFAULT_BALL_SPEED;
		gameState.ball.speedY = Number(settings.ballSpeed) || GameConfig.DEFAULT_BALL_SPEED;
		gameState.paddle1.speed = Number(settings.paddleSpeed) || GameConfig.DEFAULT_PADDLE_SPEED;
		gameState.paddle2.speed = Number(settings.paddleSpeed) || GameConfig.DEFAULT_PADDLE_SPEED;
		gameState.paddle1.height = Number(settings.paddleLength) || GameConfig.DEFAULT_PADDLE_LENGTH;
		gameState.paddle2.height = Number(settings.paddleLength) || GameConfig.DEFAULT_PADDLE_LENGTH;
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
		const player1Score = this.gameState.score.player1.score;
		const player2Score = this.gameState.score.player2.score;
		const maxScore = GameConfig.DEFAULT_MAX_SCORE;
		console.log(`Checking win: P1=${player1Score}, P2=${player2Score}, max=${maxScore}`);
		if (player1Score >= maxScore || player2Score >= maxScore) {
			return player1Score > player2Score ? 1 : 2;
		}
		return null;
	}

	transitionToGame(newGameId) {
		this.gameId = newGameId;

		// Reset for the actual game
		this.gameState.gameId = newGameId;
		this.gameState.gameStarted = false;

		// Mark both players as ready
		this.playerReadyStatus = new Set([1, 2]);

		return this;
	}

	reset() {
		this.gameState = createDefaultGameState(this.gameId);
		applySettings(this.gameState, this.settings);
	}

	getState() {
		return this.gameState;
	}
}
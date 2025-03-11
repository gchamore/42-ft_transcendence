import { createDefaultGameState } from "../../public/dist/shared/types/gameState.js";
import { TEST_MODE } from "../utils/config.js";

export class GameInstance {
	constructor(gameId, existingSettings = null, safeSendFunction = null) {
		this.gameId = gameId;
		this.isLobby = gameId.startsWith("lobby-");
		this.players = [];
		this.gameState = createDefaultGameState(gameId);
		this.settings = existingSettings || {
			ballSpeed: 4,
			paddleSpeed: 10,
			paddleLength: 150,
			mapType: "default",
			powerUpsEnabled: false,
			maxScore: 3,
		};
		this.playerReadyStatus = new Set();
		this.resetBall();
		this.paddleMoved = false;
		this.safeSend = safeSendFunction;
	}

	setPlayerReady(playerNumber) {
		this.playerReadyStatus.add(playerNumber);
		return this.playerReadyStatus.size === 2;
	}

	isGameReady() {
		return this.playerReadyStatus.size === 2;
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

	update() {
		const prevBallX = this.gameState.ball.x;
		const prevBallY = this.gameState.ball.y;

		const speedMultiplier = TEST_MODE ? 1.2 : 1.0; // Increase speed for testing
		this.gameState.ball.x += this.gameState.ball.speedX;
		this.gameState.ball.y += this.gameState.ball.speedY;

		const wallHit = this.checkWallCollision();
		const paddleHit = this.checkPaddleCollision(prevBallX, prevBallY);
		const scoreResult = this.checkScoring();

		if (wallHit) {
			this.players.forEach((player) => {
				this.safeSend(player, {
					type: "wallHit",
					position: { x: this.gameState.ball.x, y: this.gameState.ball.y }
				});
			});
		}

		if (paddleHit) {
			this.players.forEach((player) => {
				this.safeSend(player, {
					type: 'paddleHit',
					paddleNumber: paddleHit.paddleHit,
					position: paddleHit.position
				});
			});
		}

		if (scoreResult.scored) {
			this.players.forEach((player) => {
				this.safeSend(player, {
					type: 'scoreEffect',
					scorer: scoreResult.scorer,
					position: { x: prevBallX, y: prevBallY }
				});
			});
		}
		return scoreResult;
	}

	checkWallCollision() {
		const ball = this.gameState.ball;
		if (ball.y - ball.radius <= 0 || ball.y + ball.radius >= 600) {
			ball.speedY *= -1;
			// Add small random factor to avoid loops (non-TEST mode only)
			if (!TEST_MODE)
				ball.speedY += (Math.random() - 0.5) * 0.5; 
			return true;
		}
		return false;
	}

	checkPaddleCollision(prevBallX, prevBallY) {
		const ball = this.gameState.ball;
		const paddle1 = this.gameState.paddle1;
		const paddle2 = this.gameState.paddle2;

		// Paddle 1 collision
		if (
			ball.speedX < 0 && // Ball moving left
			ball.x - ball.radius <= paddle1.x + paddle1.width && //ball left edge reaches paddle right edge
			prevBallX - ball.radius > paddle1.x + paddle1.width && // ball was right of paddle previously
			ball.y + ball.radius >= paddle1.y && // ball bottom edge is below paddle top 
			ball.y - ball.radius <= paddle1.y + paddle1.height // ball top edge is above paddle bottom 
		) {
			ball.speedX = -ball.speedX;
			//add angle based on where the ball hits the paddle
			const hitPosition = (ball.y - paddle1.y) / paddle1.height;
			ball.speedY = (hitPosition - 0.5) * 10;
			const speedIncrease = 0.25; // Slightly higher increase factor
			const maxSpeed = 12; // Higher maximum speed

			// Calculate current speed magnitude
			const currentSpeed = Math.sqrt(ball.speedX * ball.speedX + ball.speedY * ball.speedY);

			// Calculate new speed magnitude (capped at maxSpeed)
			const newSpeed = Math.min(maxSpeed, currentSpeed + speedIncrease);

			// Calculate scale factor to apply to both components
			const scaleFactor = newSpeed / currentSpeed;

			// Apply to both X and Y components to maintain angle
			ball.speedX *= scaleFactor;
			ball.speedY *= scaleFactor;

			return { paddleHit: 1, position: { x: paddle1.x, y: paddle1.y } };
		}
		// Paddle 2 collision
		if (
			ball.speedX > 0 && // Ball moving right
			ball.x + ball.radius >= paddle2.x && //ball right edge reaches paddle left edge
			prevBallX + ball.radius < paddle2.x && // ball was left of paddle previously
			ball.y + ball.radius >= paddle2.y && // ball bottom edge is below paddle top
			ball.y - ball.radius <= paddle2.y + paddle2.height // ball top edge is above paddle bottom
		) {
			ball.speedX *= -1;
			//add angle based on where the ball hits the paddle
			const hitPosition = (ball.y - paddle2.y) / paddle2.height;
			ball.speedY = (hitPosition - 0.5) * 10;

			const speedIncrease = 0.25;
			const maxSpeed = 12;

			const currentSpeed = Math.sqrt(ball.speedX * ball.speedX + ball.speedY * ball.speedY);
			const newSpeed = Math.min(maxSpeed, currentSpeed + speedIncrease);
			const scaleFactor = newSpeed / currentSpeed;

			ball.speedX *= scaleFactor;
			ball.speedY *= scaleFactor;

			return { paddleHit: 2, position: { x: paddle2.x, y: paddle2.y } };
		}
		return null;
	}

	checkScoring() {
		const ball = this.gameState.ball;

		// Player 2 scores
		if (ball.x - ball.radius <= -40) {
			this.gameState.score.player2Score++;
			this.resetBall(2);
			const winner = this.checkWin();
			if (winner) {
				return { scored: true, scorer: 2, winner };
			}
			return { scored: true, scorer: 2 };
		}
		// Player 1 scores
		else if (ball.x + ball.radius >= 840) {
			this.gameState.score.player1Score++;
			this.resetBall(1);
			const winner = this.checkWin();
			if (winner) {
				return { scored: true, scorer: 1, winner };
			}
			return { scored: true, scorer: 1 };
		}
		return { scored: false };
	}

	checkWin() {
		const { player1Score, player2Score } = this.gameState.score;
		const maxScore = this.settings.maxScore || 3;
		if (player1Score >= maxScore || player2Score >= maxScore) {
			return player1Score > player2Score ? 1 : 2;
		}
		return null;
	}

	resetBall(scoringPlayer = null) {
		const ball = this.gameState.ball;
		ball.x = 400;
		ball.y = 300;
		const angle = (Math.random() * Math.PI) / 2 - Math.PI / 4;
		const speed = parseInt(this.settings.ballSpeed) || 4;
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

	updatePaddlePosition(playerNumber, y) {
		this.paddleMoved = true;
		// Get the correct paddle based on player number
		const paddle =
			playerNumber === 1
				? this.gameState.paddle1
				: this.gameState.paddle2;

		paddle.y = y;
		// Ensure paddle stays within bounds
		if (paddle.y < 0) {
			paddle.y = 0;
		}
		if (paddle.y + paddle.height > 600) {
			paddle.y = 600 - paddle.height;
		}
		return paddle.y;
	}

	cleanup() {
		this.players.forEach((player) => player.close());
		this.players = [];
	}

	getState() {
		return this.gameState;
	}

	updateSettings(newSettings) {
		// Update settings that are passed in and keep the rest the same
		this.settings = {
			...this.settings,
			...newSettings,
		};
		this.gameState.ball.speedX = parseInt(newSettings.ballSpeed);
		this.gameState.ball.speedY = parseInt(newSettings.ballSpeed);
		this.gameState.paddle1.speed = parseInt(newSettings.paddleSpeed);
		this.gameState.paddle2.speed = parseInt(newSettings.paddleSpeed);
		this.gameState.paddle1.height = parseInt(newSettings.paddleLength);
		this.gameState.paddle2.height = parseInt(newSettings.paddleLength);

		return this.settings;
	}

	transitionToGame(newGameId) {
		console.log(`Transitioning game from ${this.gameId} to ${newGameId}`);

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

		// Reset ball position and speed
		this.resetBall();

		console.log(
			`Game successfully transitioned from ${oldGameId} to ${newGameId} with ${this.players.length} players`
		);

		// Return the updated instance (this)
		return this;
	}

	resetForRematch() {
		this.gameState.score = { player1Score: 0, player2Score: 0 };
		this.gameState.paddle1.y = (600 - this.gameState.paddle1.height) / 2;
		this.gameState.paddle2.y = (600 - this.gameState.paddle2.height) / 2;
		this.gameState.servingPlayer = Math.random() < 0.5 ? 1 : 2;
		this.resetBall();
		this.playerReadyStatus.clear();
		return this;
	}
}

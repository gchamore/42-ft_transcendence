import { Ball } from "../game/classes/ball.js";
import { Paddle } from "../game/classes/paddle.js";
import { ScoreBoard } from "../game/classes/scoreBoard.js";
import { GameControls } from "../game/classes/gameControls.js";
import { InputManager } from "../game/managers/inputManager.js";
import { UIManager } from "../game/managers/uiManager.js";
import { GameState } from "@shared/types/gameState";
import { WebSocketService } from "../services/webSocketService.js";
import { BabylonManager } from "../game/managers/babylonManager.js";

export class Game {
	private babylonManager: BabylonManager | null = null;
	private uiCanvas!: HTMLCanvasElement;
	private canvas!: HTMLCanvasElement;

	private socket!: WebSocket;
	private context!: CanvasRenderingContext2D;
	private paddle1!: Paddle;
	private paddle2!: Paddle;
	private ball!: Ball;
	private scoreBoard!: ScoreBoard;
	private controls!: GameControls;
	private uiManager!: UIManager;
	private inputManager!: InputManager;
	private servingPlayer: number = 1;
	private gameStarted: boolean = false;
	private animationFrameId: number | null = null;
	private playerNumber: number = 0;
	private gameId: string;

	constructor(gameId: string) {
		this.gameId = gameId;
		this.connectWebSocket();
		this.initializeCanvas();
		this.initializeComponents();
		this.initializeBabylonScene();
		this.start();
	}

	private initializeBabylonScene() {
		this.babylonManager = new BabylonManager(
			this.canvas,
			this.paddle1,
			this.paddle2,
			this.ball
		);
	}

	private connectWebSocket() {
		this.socket = WebSocketService.getInstance().connect(this.gameId);

		this.socket.onopen = () => {
			console.log("Connected to server");
		};
		//listen for messages
		this.socket.onmessage = (message) => {
			const data = JSON.parse(message.data);
			console.log("Received message : ", data);
			switch (data.type) {
				case "gameState":
					if (data.playerNumber) {
						this.playerNumber = data.playerNumber;
						if (this.controls) {
							this.controls.setPlayerNumber(this.playerNumber);
						}
					}
					this.updateGameState(data.gameState);
					break;
				case "gameOver":
					this.handleGameOver(data);
					break;
				case "connected":
					console.log(data.message);
					break;
				case "settingsUpdate":
					this.updateSettings(data.settings);
					break;
				case "syncPaddle":
					this.handlePaddleSync(data);
					break;
				case "rematchRequested":
					this.handleRematchRequest(data);
					break;
				case "rematch":
					this.handleRematch();
					break;
				case "error":
					console.error("Game error:", data.message);
					this.uiManager.drawErrorMessage(data.message);
					break;
			}
		};

		this.socket.onerror = (error) => {
			console.error("WebSocket error:", error);
			this.uiManager.drawErrorMessage("Connection error");
		};

		this.socket.onclose = () => {
			console.log("Disconnected from server");
			if (this.gameStarted) {
				this.uiManager.drawErrorMessage("Connection to server lost");
				this.pauseGame();
			}
			setTimeout(() => {
				this.stopGame();
				// Option: Redirect to home page
				window.location.href = "/";
			}, 3000);
		};
	}

	private handleGameOver(data: any) {
		this.gameStarted = false;
		this.scoreBoard.updateScore({
			player1Score: data.score1,
			player2Score: data.score2,
		});

		if (data.reason === "opponentDisconnected") {
			//distinct message for opponent disconnection
			this.uiManager.drawDisconnectionMessage(
				`${data.message}`,
				data.winner === this.playerNumber
			);
			setTimeout(() => {
				this.stopGame();
				window.location.href = "/";
			}, 5000);
		} else {
			this.uiManager.drawGameOverMessage(
				performance.now(),
				data.winner,
				`${data.score1} - ${data.score2}`
			);
			// Regular game over message
			this.createGameOverMenu(`Player ${data.winner} wins!`);
		}

		this.pauseGame();
	}

	private createGameOverMenu(message: string) {
		const container = document.createElement("div");
		container.id = "game-over-menu";
		container.style.position = "absolute";
		container.style.top = "50%";
		container.style.left = "50%";
		container.style.transform = "translate(-50%, -50%)";
		container.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
		container.style.color = "white";
		container.style.padding = "20px";
		container.style.borderRadius = "10px";
		container.style.textAlign = "center";
		container.style.zIndex = "1000";

		// Add title
		const title = document.createElement("h2");
		title.textContent = "Game Over";
		title.style.marginBottom = "10px";
		container.appendChild(title);

		// Add message
		const messageEl = document.createElement("p");
		messageEl.textContent = message;
		messageEl.style.marginBottom = "20px";
		container.appendChild(messageEl);

		// Add buttons container
		const buttonsContainer = document.createElement("div");
		buttonsContainer.style.display = "flex";
		buttonsContainer.style.justifyContent = "space-between";
		buttonsContainer.style.gap = "10px";

		// Add rematch button
		const rematchButton = document.createElement("button");
		rematchButton.textContent = "Rematch";
		rematchButton.style.padding = "8px 16px";
		rematchButton.style.backgroundColor = "#4CAF50";
		rematchButton.style.color = "white";
		rematchButton.style.border = "none";
		rematchButton.style.borderRadius = "4px";
		rematchButton.style.cursor = "pointer";
		rematchButton.onclick = () => this.requestRematch();
		buttonsContainer.appendChild(rematchButton);

		// Add home button
		const homeButton = document.createElement("button");
		homeButton.textContent = "Return Home";
		homeButton.style.padding = "8px 16px";
		homeButton.style.backgroundColor = "#f44336";
		homeButton.style.color = "white";
		homeButton.style.border = "none";
		homeButton.style.borderRadius = "4px";
		homeButton.style.cursor = "pointer";
		homeButton.onclick = () => (window.location.href = "/");
		buttonsContainer.appendChild(homeButton);

		container.appendChild(buttonsContainer);
		document.body.appendChild(container);
	}

	private requestRematch() {
		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			this.socket.send(
				JSON.stringify({
					type: "rematchRequest",
					player: this.playerNumber,
				})
			);

			// Update UI to waiting state
			const container = document.getElementById("game-over-menu");
			if (container) {
				container.innerHTML = `
				<h2>Waiting for Opponent</h2>
				<p>Rematch request sent...</p>
				<div style="margin-top: 20px;">
					<div class="spinner"></div>
				</div>
			`;
			}

			let waitingAnimationId: number | null = null;

			const waittingAnimation = (timestamp: number) => {
				this.uiManager.drawWaitingForRematch(timestamp);
				waitingAnimationId = requestAnimationFrame(waittingAnimation);
			};
			waitingAnimationId = requestAnimationFrame(waittingAnimation);

			const originalHandleRematch = this.handleRematch;
			this.handleRematch = () => {
				if (waitingAnimationId) {
					cancelAnimationFrame(waitingAnimationId);
					waitingAnimationId = null;
				}
				this.handleRematch = originalHandleRematch;
				originalHandleRematch.call(this);
			};
		}
	}

	private handleRematchRequest(data: any): void {
		const container = document.getElementById("game-over-menu");
		if (container) {
			container.innerHTML = `
			<h2>Rematch Request</h2>
			<p>Player ${data.player} wants a rematch!</p>
			<div style="display: flex; justify-content: space-between; gap: 10px; margin-top: 20px;">
				<button id="accept-rematch" style="padding: 8px 16px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Accept</button>
				<button id="decline-rematch" style="padding: 8px 16px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">Decline</button>
			</div>
		`;
			document
				.getElementById("accept-rematch")
				?.addEventListener("click", () => this.requestRematch());
			document
				.getElementById("decline-rematch")
				?.addEventListener("click", () => (window.location.href = "/"));
		}
	}

	private handleRematch(): void {
		console.log("Rematch accepted");
		this.uiManager.clearOverlay();
		const container = document.getElementById("game-over-menu");
		if (container) {
			container.remove();
		}
		if (!this.animationFrameId) {
			this.start();
		}
	}

	pauseGame() {
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
	}

	private updateGameState(gameState: GameState) {
		if (!gameState) {
			console.error("Received invalid game state");
			return;
		}
		this.gameStarted = gameState.gameStarted ?? false;
		this.servingPlayer = gameState.servingPlayer ?? this.servingPlayer;

		if (gameState.ball) {
			if (gameState.ball.x !== null && gameState.ball.y !== null) {
				this.ball.updatePosition(gameState.ball);
			}
		}
		if (gameState.paddle1) {
			this.paddle1.updatePosition(gameState.paddle1);
		}
		if (gameState.paddle2) {
			this.paddle2.updatePosition(gameState.paddle2);
		}
		if (gameState.score) {
			this.scoreBoard.updateScore(gameState.score);
		}
	}

	private initializeCanvas() {
		this.canvas = document.getElementById(
			"gameCanvas"
		) as HTMLCanvasElement;
		this.canvas.style.display = "block";

		this.uiCanvas = document.getElementById(
			"uiCanvas"
		) as HTMLCanvasElement;
		this.context = this.canvas.getContext("2d")!;
	}

	private initializeComponents() {
		this.ball = new Ball(400, 300, 10, 4);
		this.paddle1 = new Paddle(
			10,
			(this.canvas.height - 100) / 2,
			10,
			100,
			4
		);
		this.paddle2 = new Paddle(
			780,
			(this.canvas.height - 100) / 2,
			10,
			100,
			4
		);

		this.scoreBoard = new ScoreBoard();
		this.uiManager = new UIManager(this.context, this.uiCanvas);

		this.controls = new GameControls(
			this.paddle1,
			this.paddle2,
			this.playerNumber,
			this.socket
		);
		this.inputManager = new InputManager(this.controls);
	}

	private gameLoop(timestamp: number): void {
		if (this.uiCanvas && this.context)
			this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

		if (!this.gameStarted) {
			this.uiManager.drawStartMessage(
				timestamp,
				this.gameStarted,
				this.playerNumber,
				this.servingPlayer
			);
		}

		this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
	}

	start(): void {
		this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
	}

	stopGame(): void {
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
		this.inputManager.removeEventListeners();

		if (this.babylonManager) {
			this.babylonManager.dispose();
			this.babylonManager = null;
		}
	}

	private updateSettings(settings: any) {
		this.ball.speedX = settings.ballSpeed;
		this.ball.speedY = settings.ballSpeed;
		this.paddle1.speed = settings.paddleSpeed;
		this.paddle2.speed = settings.paddleSpeed;
		this.paddle1.height = settings.paddleLength;
		this.paddle2.height = settings.paddleLength;
	}

	// Correct paddle position if server rejects movement
	private handlePaddleSync(data: any) {
		console.log("server rejected paddle movement:", data.message);
		if (this.playerNumber === 1) {
			this.paddle1.y = data.position;
		} else if (this.playerNumber === 2) {
			this.paddle2.y = data.position;
		}
		this.controls.syncPaddlePosition(data.position);
	}
}

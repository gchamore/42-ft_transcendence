/// <reference path="../types/babylon.d.ts" />
import { Ball } from "../game/classes/ball.js";
import { Paddle } from "../game/classes/paddle.js";
import { ScoreBoard } from "../game/classes/scoreBoard.js";
import { GameControls } from "../game/classes/gameControls.js";
import { InputManager } from "../game/managers/inputManager.js";
import { UIManager } from "../game/managers/uiManager.js";
import { GameState } from "@shared/types/gameState";
import { WebSocketService } from "../services/webSocketService.js";
import { BabylonManager } from "../game/managers/babylonManager.js";
import { FPSManager } from "../game/managers/fpsManager.js";

export class Game {
	private babylonManager: BabylonManager | null = null;
	private uiCanvas!: HTMLCanvasElement;
	private canvas!: HTMLCanvasElement;

	private fpsManager!: FPSManager;

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
	private isLoading: boolean = true;

	constructor(gameId: string) {
		this.gameId = gameId;
		this.playerNumber = WebSocketService.getInstance().getPlayerNumber();
		this.connectWebSocket();
		this.initializeCanvas();
		this.initializeComponents();
		this.initializeBabylonScene();
		this.start();
	}

	private initializeBabylonScene() {
		try {
			const canvas = document.createElement('canvas');
			const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

			if (!gl) {
				console.warn("WebGL not available, skipping 3D mode");
				this.isLoading = false;
				return;
			}

			if (!BABYLON.Engine.isSupported()) {
				console.error("WebGL not supported");
				return;
			}

			this.babylonManager = new BabylonManager(
				this.canvas,
				this.paddle1,
				this.paddle2,
				this.ball,
				() => {
					console.log("3D scene loading complete");
					this.isLoading = false; // Update loading state
				}
			);

			if (this.babylonManager) {
				this.fpsManager = new FPSManager(this.babylonManager.getEngine());
				this.fpsManager.toggleVisibility(true);
			} else {
				this.fpsManager = new FPSManager();
			}
		} catch (error) {
			console.error("Error initializing Babylon scene", error);
			this.isLoading = false;
		}
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
				case "wallHit":
					// if (this.babylonManager) {
					// 	this.babylonManager.handleWallHit(data.position);
					// }
					console.log("Wall hit at position", data.position);
					break;
				case "scoreEffect":
					// if (this.babylonManager) {
					// 	this.babylonManager.handleScoreEffect(data.scorer, data.position);
					// }
					console.log("Score effect at position", data.position);
					break
				case "gameStartAnimation":
					// if (this.babylonManager) {
					// 	this.babylonManager.handleGameStartAnimation();
					// }
					console.log("Game start animation");
					break;
				case "paddleHit":
					// if (this.babylonManager) {
					// 	this.babylonManager.handlePaddleHit(data.player);
					// }
					console.log("Paddle hit by player", data.player);
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
		const container = document.getElementById("game-over-menu") as HTMLElement;
		const messageEl = document.getElementById("game-over-message") as HTMLElement;

		// Clear any previous states
		document.getElementById("waiting-rematch")!.style.display = "none";
		document.getElementById("rematch-request")!.style.display = "none";

		// Show main content elements
		document.getElementById("game-over-title")!.style.display = "block";
		document.getElementById("game-over-buttons")!.style.display = "flex";

		// Set message and show main content
		messageEl.textContent = message;
		container.style.display = "block";

		// Set up event listeners
		document.getElementById("rematch-button")!.onclick = () => this.requestRematch();
		document.getElementById("home-button")!.onclick = () => window.location.href = "/";
	}

	private requestRematch() {
		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			this.socket.send(
				JSON.stringify({
					type: "rematchRequest",
					player: this.playerNumber,
				})
			);

			// Hide main content elements
			document.getElementById("game-over-title")!.style.display = "none";
			document.getElementById("game-over-message")!.style.display = "none";
			document.getElementById("game-over-buttons")!.style.display = "none";

			document.getElementById("waiting-rematch")!.style.display = "block";

			let waitingAnimationId: number | null = null;

			const waitingAnimation = (timestamp: number) => {
				this.uiManager.drawWaitingForRematch(timestamp);
				waitingAnimationId = requestAnimationFrame(waitingAnimation);
			};
			waitingAnimationId = requestAnimationFrame(waitingAnimation);

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
		// Hide main content elements
		document.getElementById("game-over-title")!.style.display = "none";
		document.getElementById("game-over-message")!.style.display = "none";
		document.getElementById("game-over-buttons")!.style.display = "none";

		const messageEl = document.getElementById("rematch-request-message") as HTMLElement;
		messageEl.textContent = `Player ${data.player} has requested a rematch`;

		document.getElementById("rematch-request")!.style.display = "block";
		document.getElementById("game-over-menu")!.style.display = "block";

		// Set up event listeners
		document.getElementById("accept-rematch")!.onclick = () => this.requestRematch();
		document.getElementById("decline-rematch")!.onclick = () => window.location.href = "/";
	}

	private handleRematch(): void {
		console.log("Rematch accepted");
		this.uiManager.clearOverlay();
		const container = document.getElementById("game-over-menu");
		if (container) {
			container.style.display = "none";
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
		if (gameState.score && !this.isLoading) {
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
		this.context = this.uiCanvas.getContext("2d")!;
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

		this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));

		if (this.fpsManager) {
			this.fpsManager.update(timestamp);
		}

		if (!this.isLoading && this.babylonManager) {
			this.babylonManager.render(timestamp);
		}

		if (!this.isLoading) {
			this.scoreBoard.updateDisplay();
			if (!this.gameStarted) {
				this.uiManager.drawStartMessage(
					timestamp,
					this.gameStarted,
					this.playerNumber,
					this.servingPlayer
				);
			}
		}

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

		if (this.fpsManager) {
			this.fpsManager.dispose();
		}

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

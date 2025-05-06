/// <reference path="../types/babylon.d.ts" />
import { Ball } from "../game/classes/ball.js";
import { Paddle } from "../game/classes/paddle.js";
import { ScoreBoard } from "../game/classes/scoreBoard.js";
import { GameControls } from "../game/classes/gameControls.js";
import { InputManager } from "../game/managers/inputManager.js";
import { UIManager } from "../game/managers/uiManager.js";
import { GameState } from "../../shared/types/gameState.js";
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
	private mapType: string = "";
	private powerUpsEnabled: boolean = false;
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

	constructor(gameId: string, settings: any) {
		this.gameId = gameId;
		this.playerNumber = WebSocketService.getInstance().getPlayerNumber();
		this.connectWebSocket();
		this.initializeCanvas();
		this.initializeComponents(settings);
		this.initializeBabylonScene();
		this.initializeGameManagers();
		
		this.start();
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

	private initializeComponents(settings: any) {
		this.ball = new Ball();
		this.paddle1 = new Paddle(10, 250);
		this.paddle2 = new Paddle(780, 250);
		this.updateSettings(settings);
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
				this.mapType,
				this.powerUpsEnabled,
				this.playerNumber,
				() => {
					console.log("3D scene loading complete");
					this.isLoading = false;
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
	
		private initializeGameManagers() {
			this.controls = new GameControls(
				this.paddle1,
				this.paddle2,
				this.ball,
				this.playerNumber,
				this.socket,
				this.babylonManager!
			);
			this.scoreBoard = new ScoreBoard();
			this.uiManager = new UIManager(this.context, this.uiCanvas, this.powerUpsEnabled);
			this.inputManager = new InputManager(this.controls);
		}

	private connectWebSocket() {
		this.socket = WebSocketService.getInstance().connect(this.gameId, 'game');
		
		this.socket.onopen = () => {
			console.log("Connected to the game");
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
				case "error":
					console.error("Game error:", data.message);
					this.uiManager.drawErrorMessage(data.message);
					break;
				case "scoreEffect":
					if (this.babylonManager) {
						this.babylonManager.handleScoreEffect(data.scorer, data.position);
					}
					console.log("Score effect at position", data.position);
					break
				case "paddleHit":
					if (this.babylonManager) {
						this.babylonManager.handlePaddleHit(data.playerNumber, data.ballPosition);
					}
					console.log("Paddle hit by player", data.player);
					break;
				case "wallBounce":
					if (this.babylonManager) {
						this.babylonManager.handleBounce(data.position);
					}
					break;
				case "powerupSpawn":
					if (this.babylonManager && this.powerUpsEnabled) {
						this.babylonManager.createPowerupMesh(data.powerup);
					}
					break;
				case "powerupCollected":
					if (this.babylonManager && this.powerUpsEnabled) {
						this.babylonManager.handlePowerupCollection(data.powerupId, data.playerNumber);
						this.uiManager.addActivePowerup(data.powerupId, data.powerupType, data.playerNumber);
					}
					break;
				case "powerupDeactivated":
					if (this.babylonManager && this.powerUpsEnabled) {
						this.babylonManager.handlePowerupDeactivation(data.powerupId);
						this.uiManager.removeActivePowerup(data.powerupId);
					}
					break;
				case 'ping':
					this.socket.send(JSON.stringify({ type: 'pong' }));
					break;
			}
		};

		this.socket.onerror = (error) => {
			console.error("WebSocket error:", error);
			this.uiManager.drawErrorMessage("Connection error");
		};

		this.socket.onclose = () => {
			console.log("WS Disconnected from the game");
			if (this.gameStarted) {
				this.uiManager.drawErrorMessage("Connection to server lost");
			}
		};
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
				this.controls.storeBallPosition(gameState.ball);
			}
			if (this.ball.radius !== gameState.ball.radius) {
				this.ball.radius = gameState.ball.radius;
			}
		}
		this.scoreBoard.updateScore(gameState.score);

		if (gameState.paddle1 && gameState.paddle2) {

			if (gameState.paddle1 && gameState.paddle2) {
				this.controls.updateServerPaddlePosition(gameState.paddle1, gameState.paddle2);
				if (this.babylonManager)
					this.babylonManager.updateGameState(gameState);
			}
		}
	}

	private gameLoop(timestamp: number): void {
		
		if (this.uiCanvas && this.context)
			this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

		if (this.fpsManager) {
			this.fpsManager.update(timestamp);
		}

		if (!this.isLoading) {
			this.controls.update(timestamp);
			if (this.babylonManager) {
				this.babylonManager.render(timestamp);
			}
			if (!this.gameStarted) {
				this.uiManager.drawStartMessage(
					timestamp,
					this.gameStarted,
					this.playerNumber,
					this.servingPlayer
				);
			}
			if (this.powerUpsEnabled)
				this.uiManager.drawPowerupStatus();
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

		if (this.controls) {
			this.controls.dispose();
		}
		if (this.fpsManager) {
			this.fpsManager.dispose();
		}

		if (this.babylonManager) {
			this.babylonManager.dispose();
			this.babylonManager = null;
		}
		 if (this.socket && this.socket.readyState === WebSocket.OPEN)
			this.socket.close(1000, "Game stopped");

	}

	private updateSettings(settings: any = null) {
		if (settings) {
			this.ball.speedX = settings.ballSpeed;
			this.ball.speedY = settings.ballSpeed;
			this.paddle1.speed = settings.paddleSpeed;
			this.paddle2.speed = settings.paddleSpeed;
			this.paddle1.height = settings.paddleLength;
			this.paddle2.height = settings.paddleLength;
			this.mapType = settings.mapType;
			this.powerUpsEnabled = settings.powerUpsEnabled;
			return;
		}
	}

	private handleGameOver(data: any) {
		this.gameStarted = false;
		this.pauseGame();

		const finalScore = data.finalScore || { player1Score: 0, player2Score: 0 };
	
		this.scoreBoard.updateScore({
			player1Score: finalScore.player1Score,
			player2Score: finalScore.player2Score,
		});

		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			this.socket.send(
				JSON.stringify({
					type: "gameOver",
					matchId: this.gameId,
					winner: data.winner,
				}));
		}

		if (this.isTournamentGame(this.gameId)) {
			this.showWaitingForNextMatch();
		} else {
			this.createGameOverMenu(`Player ${data.winner} wins!`, `${finalScore.player1Score} - ${finalScore.player2Score}`);
		}
	}
	private isTournamentGame(gameId: string): boolean {
		return gameId.includes('semi');
	}

	private showWaitingForNextMatch() {
		const container = document.getElementById("game-over-menu") as HTMLElement;
		const messageEl = document.getElementById("game-over-message") as HTMLElement;
		const scoreEl = document.getElementById("game-over-score") as HTMLElement;

		document.getElementById("game-over-title")!.style.display = "block";
		document.getElementById("game-over-buttons")!.style.display = "none";
		messageEl.textContent = "Waiting for other match to finish...";
		scoreEl.textContent = "";
		container.style.display = "block";
	}
	
	private createGameOverMenu(message: string, score?: string) {
		const container = document.getElementById("game-over-menu") as HTMLElement;
		const messageEl = document.getElementById("game-over-message") as HTMLElement;
		const scoreEl = document.getElementById("game-over-score") as HTMLElement;

		// Show main content elements
		document.getElementById("game-over-title")!.style.display = "block";
		document.getElementById("game-over-buttons")!.style.display = "flex";
	
		// Set message and show main content
		messageEl.textContent = message;
		scoreEl.textContent = score ? `Final Score: ${score}` : "";
		container.style.display = "block";
	
		// Set up event listeners
		document.getElementById("home-button")!.onclick = () => {
			container.style.display = "none";
			console.log("Going to home");
			(window as any).go_section('home');
		}	
	}
}

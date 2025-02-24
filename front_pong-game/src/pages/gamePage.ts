import { Ball } from '../game/classes/ball.js';
import { Paddle } from '../game/classes/paddle.js';
import { ScoreBoard } from '../game/classes/scoreBoard.js';
import { GameControls } from '../game/classes/gameControls.js';
import { InputManager } from '../game/managers/inputManager.js';
import { UIManager } from '../game/managers/uiManager.js';
import { SettingsService } from '../services/settingsServices.js';
import { GameState } from '../game/classes/gameState.js';

export class Game {
	private socket!: WebSocket;
	private canvas!: HTMLCanvasElement;
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

	constructor() {
		this.connectWebSocket();
		this.initializeCanvas();
		this.initializeComponents();
		this.start();
	}

	private connectWebSocket() {
		this.socket = new WebSocket('ws://localhost:3000/game');
		this.socket.onopen = () => {
			console.log('Connected to server');
		};
		//listen for gameState updates
		this.socket.onmessage = (message) => {
			const data = JSON.parse(message.data);
			if (data.type === 'gameState') {
				if (data.playerNumber) {
					this.playerNumber = data.playerNumber;
				}
				this.updateGameState(data.gameState);
			}
		};
		this.socket.onerror = (error) => {
			console.error('WebSocket error:', error);
		};

		this.socket.onclose = () => {
			console.log('Disconnected from server');
		};
	}

	private updateGameState(gameState: GameState) {
		this.gameStarted = gameState.gameStarted;
		if (gameState.playerNumber) {
			this.playerNumber = gameState.playerNumber;
		}
		this.servingPlayer = gameState.servingPlayer;
		this.paddle1.updatePosition(gameState.paddle1);
		this.paddle2.updatePosition(gameState.paddle2);
		this.ball.updatePosition(gameState.ball);
		this.scoreBoard.updateScore(gameState.score);
		this.uiManager.drawStartMessage(performance.now(), this.gameStarted, this.playerNumber, this.servingPlayer);
	}

	private initializeCanvas() {
		this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
		this.context = this.canvas.getContext('2d')!;
	}

	private initializeComponents() {
		const settings = SettingsService.loadSettings();
		this.ball = new Ball(400, 300, 10, settings.ballSpeed);

		this.paddle1 = new Paddle(10, this.canvas.height / 2, 10, settings.paddleLength, settings.paddleSpeed);
		this.paddle2 = new Paddle(780, this.canvas.height / 2, 10, settings.paddleLength, settings.paddleSpeed);
		this.controls = new GameControls(this.paddle1, this.paddle2, this.playerNumber, this.socket);

		this.servingPlayer = Math.random() < 0.5 ? 1 : 2;
		this.scoreBoard = new ScoreBoard();
		this.uiManager = new UIManager(this.context, this.canvas);
		this.inputManager = new InputManager(this.controls, () => this.gameStarted, this.socket);
	}



	private gameLoop(timestamp: number): void {
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

		// this.updatePaddles();

		this.context.fillStyle = "white";
		this.context.fillRect(this.paddle1.x, this.paddle1.y, this.paddle1.width, this.paddle1.height);
		this.context.fillRect(this.paddle2.x, this.paddle2.y, this.paddle2.width, this.paddle2.height);

		this.context.beginPath();
		this.context.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
		this.context.fillStyle = "white";
		this.context.fill();
		this.context.closePath();

		if (!this.gameStarted) {
			this.uiManager.drawStartMessage(timestamp, this.gameStarted, this.playerNumber, this.servingPlayer);
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
	}
}
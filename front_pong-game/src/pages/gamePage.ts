import { Ball } from '../game/classes/ball.js';
import { Paddle } from '../game/classes/paddle.js';
import { ScoreBoard } from '../game/classes/scoreBoard.js';
import { GameControls } from '../game/classes/gameControls.js';
import { InputManager } from '../game/managers/inputManager.js';
import { UIManager } from '../game/managers/uiManager.js';
import { GameState } from '@shared/types/gameState';

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
	private gameId: string;

	constructor(gameId: string) {
		this.gameId = gameId;
		this.connectWebSocket();
		this.initializeCanvas();
		this.initializeComponents();
		this.start();
	}

	private connectWebSocket() {
		this.socket = new WebSocket(`ws://localhost:3000/game/${this.gameId}`);
		this.socket.onopen = () => {
			console.log('Connected to server');
		};
		//listen for gameState updates
		this.socket.onmessage = (message) => {
			const data = JSON.parse(message.data);
			console.log('Received message : ', data);
			switch (data.type) {
				case 'gameState':
					if (data.playerNumber) {
						this.playerNumber = data.playerNumber;
					}
					this.updateGameState(data.gameState);
					break;
				case 'gameOver':
					this.handleGameOver(data);
					break;
				case 'connected':
					console.log(data.message);
					break;
				case 'settingsUpdate':
					this.updateSettings(data.settings);
					break;
				case 'error':
					console.error('Game error:', data.message);
					this.uiManager.drawErrorMessage(data.message);
					break;
			};
			this.socket.onerror = (error) => {
				console.error('WebSocket error:', error);
			};

			this.socket.onclose = () => {
				console.log('Disconnected from server');
			};
		}
	}
	private handleGameOver(data: any) {
		this.gameStarted = false;
		this.scoreBoard.updateScore({ player1Score: data.score1, player2Score: data.score2 });
		// this.uiManager.drawGameOverMessage(performance.now(), data.winner);
		this.stopGame();
	}

	private updateGameState(gameState: GameState) {
		if (!gameState) {
			console.error('Received invalid game state');
			return;
		}
		this.gameStarted = gameState.gameStarted ?? false;
		this.servingPlayer = gameState.servingPlayer ?? this.servingPlayer;

		if(gameState.ball) {
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
		this.uiManager.drawStartMessage(performance.now(), this.gameStarted, this.playerNumber, this.servingPlayer);
	}

	private initializeCanvas() {
		this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
		this.context = this.canvas.getContext('2d')!;
	}

	private initializeComponents() {

		this.ball = new Ball(400, 300, 10, 4);
		this.paddle1 = new Paddle(10, this.canvas.height / 2, 10, 100, 4);
		this.paddle2 = new Paddle(780, this.canvas.height / 2, 10, 100, 4);

		this.scoreBoard = new ScoreBoard();
		this.uiManager = new UIManager(this.context, this.canvas);

		this.controls = new GameControls(this.paddle1, this.paddle2, this.playerNumber, this.socket);
		this.inputManager = new InputManager(this.controls, () => this.gameStarted);
	}



	private gameLoop(timestamp: number): void {
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

		// draw game elements
		this.context.fillStyle = "white";
		this.context.fillRect(this.paddle1.x, this.paddle1.y, this.paddle1.width, this.paddle1.height);
		this.context.fillRect(this.paddle2.x, this.paddle2.y, this.paddle2.width, this.paddle2.height);

		this.context.beginPath();
		this.context.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
		this.context.fillStyle = "white";
		this.context.fill();
		this.context.closePath();

		this.uiManager.drawStartMessage(timestamp, this.gameStarted, this.playerNumber, this.servingPlayer, );

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

	private updateSettings(settings: any) {
		this.ball.speedX = settings.ballSpeed;
		this.ball.speedY = settings.ballSpeed;
		this.paddle1.speed = settings.paddleSpeed;
		this.paddle2.speed = settings.paddleSpeed;
		this.paddle1.height = settings.paddleLength;
		this.paddle2.height = settings.paddleLength;
	}
}
import { Ball } from './classes/Ball.js';
import { Paddle } from './classes/Paddle.js';
import { ScoreBoard } from './classes/ScoreBoard.js';
import { GameControls } from './classes/GameControls.js';
import { GameConfig } from './config/GameConfig.js';
import { SettingsManager } from './managers/SettingsManager.js';
import { CollisionManager } from './managers/CollisionManager.js';
import { InputManager } from './managers/InputManager.js';
import { UIManager } from './managers/UIManager.js';

export class Game {
	private canvas!: HTMLCanvasElement;
	private context!: CanvasRenderingContext2D;
	private settingsManager!: SettingsManager;
    private ball!: Ball;
    private paddle1!: Paddle;
	private paddle2!: Paddle;
	private scoreBoard!: ScoreBoard;
	private controls!: GameControls;
	private inputManager!: InputManager;
	private collisionManager!: CollisionManager;
	private uiManager!: UIManager;
	private gameStarted: boolean = false;
	private servingPlayer!: number;
	private animationFrameId: number | null = null;

    constructor() {
        this.initializeCanvas();
		this.initializeComponents();
    }

    private initializeCanvas() {
        this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
		this.context = this.canvas.getContext('2d')!;
    }

	private initializeComponents() {
		this.ball = new Ball(400, 300, 10, GameConfig.DEFAULT_BALL_SPEED);
		this.paddle1 = new Paddle(10, this.canvas.height / 2, 10, GameConfig.DEFAULT_PADDLE_LENGTH, GameConfig.DEFAULT_PADDLE_SPEED);
		this.paddle2 = new Paddle(780, this.canvas.height / 2, 10, GameConfig.DEFAULT_PADDLE_LENGTH, GameConfig.DEFAULT_PADDLE_SPEED);
		this.scoreBoard = new ScoreBoard(GameConfig.WINNING_SCORE);
		this.controls = new GameControls();
		this.servingPlayer = Math.random() < 0.5 ? 1 : 2;
		this.settingsManager = new SettingsManager(this.ball, this.paddle1, this.paddle2);
		this.uiManager = new UIManager(this.context, this.canvas);
		this.collisionManager = new CollisionManager();
		this.inputManager = new InputManager(this.controls, () => this.gameStarted, this.startGame.bind(this));
	}

	resetBall(): void {
		this.ball.reset(this.canvas.width, this.canvas.height);
		this.resetPaddles();
		this.gameStarted = false;
	}

	resetPaddles(): void {
		this.paddle1.y = (this.canvas.height - this.paddle1.height) / 2;
		this.paddle2.y = (this.canvas.height - this.paddle2.height) / 2;
	}

	serveBall(): void {
		const direction = this.servingPlayer === 1 ? 1 : -1;
		const speed = parseInt(this.settingsManager.getBallSpeed());
		this.ball.serve(direction, speed);
		this.gameStarted = true;
	}

	private updatePaddles(): void {
		this.paddle1.move(this.controls.player1.up, this.controls.player1.down, this.canvas.height);
		this.paddle2.move(this.controls.player2.up, this.controls.player2.down, this.canvas.height);
	}

	private startGame() {
		this.gameStarted = true;
		this.serveBall();
	}

	private gameLoop(timestamp: number): void {
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

		this.updatePaddles();

		this.context.fillStyle = "white";
		this.context.fillRect(this.paddle1.x, this.paddle1.y, this.paddle1.width, this.paddle1.height);
		this.context.fillRect(this.paddle2.x, this.paddle2.y, this.paddle2.width, this.paddle2.height);
		
		this.context.beginPath();
		this.context.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
		this.context.fillStyle = "white";
		this.context.fill();
		this.context.closePath();

		this.uiManager.drawStartMessage(timestamp, this.gameStarted);

		if (this.gameStarted) {
			this.ball.move();
		}

		this.handleCollisions();

		requestAnimationFrame(this.gameLoop.bind(this));
	}

	private handleCollisions(): void {
		this.collisionManager.handleWallCollision(this.ball, this.canvas);

		if (this.ball.x - this.ball.radius <= this.paddle1.x + this.paddle1.width &&
			this.ball.y >= this.paddle1.y &&
			this.ball.y <= this.paddle1.y + this.paddle1.height &&
			this.ball.speedX < 0) {
			this.collisionManager.handlePaddleCollision(this.ball, this.paddle1);
		}

		if (this.ball.x + this.ball.radius >= this.paddle2.x &&
			this.ball.y >= this.paddle2.y &&
			this.ball.y <= this.paddle2.y + this.paddle2.height &&
			this.ball.speedX > 0) {
			this.collisionManager.handlePaddleCollision(this.ball, this.paddle2);
		}

		if (this.ball.x < 0) {
			this.scoreBoard.incrementPlayer2();
			const winner = this.scoreBoard.checkWinner();
			if (winner) {
				alert(`Game is over, ${winner} wins!`);
				this.scoreBoard.reset();
				this.stopGame();
			}
			this.servingPlayer = 1;
			this.resetBall();
		} else if (this.ball.x > this.canvas.width) {
			this.scoreBoard.incrementPlayer1();
			const winner = this.scoreBoard.checkWinner();
			if (winner) {
				alert(`Game is over, ${winner} wins!`);
				this.scoreBoard.reset();
				this.stopGame();
			}
			this.servingPlayer = 2;
			this.resetBall();
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
		this.inputManager.cleanup();
	}

}
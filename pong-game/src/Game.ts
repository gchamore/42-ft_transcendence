import { Ball } from './classes/Ball';
import { Paddle } from './classes/Paddle';
import { ScoreBoard } from './classes/ScoreBoard';
import { GameControls } from './classes/GameControls';
import { SettingsManager } from './managers/SettingsManager';
import { CollisionManager } from './managers/CollisionManager';
import { InputManager } from './managers/InputManager';

export class Game {
	private canvas: HTMLCanvasElement;
	private context: CanvasRenderingContext2D;
    private ball: Ball;
    private paddle1: Paddle;
	private paddle2: Paddle;
	private scoreBoard: ScoreBoard;
	private controls: GameControls;
	private gameStarted: boolean = false;
	private servingPlayer: number;

    constructor() {
        this.initializeCanvas();
		this.initializeComponents();
		this.initializeEventListeners();
    }

    private initializeCanvas() {
        this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
		this.context = this.canvas.getContext('2d')!;
    }

	private initializeComponents() {
		this.ball = new Ball(400, 300, 10, 4);
		this.paddle1 = new Paddle(10, this.canvas.height / 2, 10, 100);
		this.paddle2 = new Paddle(780, this.canvas.height / 2, 10, 100);
		this.scoreBoard = new ScoreBoard(SettingsManager.WINNING_SCORE);
		this.controls = new GameControls();
		this.servingPlayer = Math.random() < 0.5 ? 1 : 2;
	}
	
	resetBall(): void {
		this.ball.reset(this.canvas.width, this.canvas.height);
		this.gameStarted = false;
	}

	serverBall(): void {
		const direction = this.servingPlayer === 1 ? 1 : -1;
		const speed = parseInt(this.settingsManager.getBallSpeed());
		this.ball.serve(direction, speed);
		this.gameStarted = true;
	}
    start(): void {
        requestAnimationFrame(this.gameLoop.bind(this));
    }
}
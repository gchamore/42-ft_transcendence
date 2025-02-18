import { Ball } from '../game/classes/ball.js';
import { Paddle } from '../game/classes/paddle.js';
import { ScoreBoard } from '../game/classes/scoreBoard.js';
import { GameControls } from '../game/classes/gameControls.js';
import { GameConfig } from '../utils/config/gameConfig.js';
import { CollisionManager } from '../game/managers/collisionManager.js';
import { InputManager } from '../game/managers/inputManager.js';
import { UIManager } from '../game/managers/uiManager.js';
import { SettingsService } from '../services/settingsServices.js';
export class Game {
    constructor() {
        this.gameStarted = false;
        this.animationFrameId = null;
        this.initializeCanvas();
        this.initializeComponents();
    }
    initializeCanvas() {
        this.canvas = document.getElementById('gameCanvas');
        this.context = this.canvas.getContext('2d');
    }
    initializeComponents() {
        const settings = SettingsService.loadSettings();
        this.ball = new Ball(400, 300, 10, settings.ballSpeed);
        this.paddle1 = new Paddle(10, this.canvas.height / 2, 10, settings.paddleLength, settings.paddleSpeed);
        this.paddle2 = new Paddle(780, this.canvas.height / 2, 10, settings.paddleLength, settings.paddleSpeed);
        this.scoreBoard = new ScoreBoard(GameConfig.WINNING_SCORE);
        this.controls = new GameControls();
        this.servingPlayer = Math.random() < 0.5 ? 1 : 2;
        this.uiManager = new UIManager(this.context, this.canvas);
        this.collisionManager = new CollisionManager();
        this.inputManager = new InputManager(this.controls, () => this.gameStarted, this.startGame.bind(this));
    }
    resetBall() {
        this.ball.reset(this.canvas.width, this.canvas.height);
        this.resetPaddles();
        this.gameStarted = false;
    }
    resetPaddles() {
        this.paddle1.y = (this.canvas.height - this.paddle1.height) / 2;
        this.paddle2.y = (this.canvas.height - this.paddle2.height) / 2;
    }
    serveBall() {
        const direction = this.servingPlayer === 1 ? 1 : -1;
        const speed = this.ball.speedX;
        this.ball.serve(direction, speed);
        this.gameStarted = true;
    }
    updatePaddles() {
        this.paddle1.move(this.controls.player1.up, this.controls.player1.down, this.canvas.height);
        this.paddle2.move(this.controls.player2.up, this.controls.player2.down, this.canvas.height);
    }
    startGame() {
        this.gameStarted = true;
        this.serveBall();
    }
    gameLoop(timestamp) {
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
    handleCollisions() {
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
        }
        else if (this.ball.x > this.canvas.width) {
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
    start() {
        this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
    }
    stopGame() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.inputManager.cleanup();
    }
}

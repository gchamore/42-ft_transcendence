import { GameConfig } from '../config/GameConfig.js';
export class SettingsManager {
    constructor(ball, paddle1, paddle2) {
        this.ball = ball;
        this.paddle1 = paddle1;
        this.paddle2 = paddle2;
        this.initializeElements();
        this.loadSettings();
    }
    initializeElements() {
        try {
            this.ballSpeedSlider = document.getElementById('ball-speed');
            this.ballSpeedValue = document.getElementById('ball-speed-value');
            this.paddleLengthSlider = document.getElementById('paddle-length');
            this.paddleLengthValue = document.getElementById('paddle-length-value');
            this.paddleSpeedSlider = document.getElementById('paddle-speed');
            this.paddleSpeedValue = document.getElementById('paddle-speed-value');
            if (!this.ballSpeedSlider || !this.paddleLengthSlider || !this.paddleSpeedSlider) {
                throw new Error('Required DOM elements not found');
            }
        }
        catch (error) {
            console.error('Failed to initialize settings elements:', error);
            throw error;
        }
    }
    loadSettings() {
        const savedBallSpeed = localStorage.getItem('ballSpeed');
        const savedPaddleLength = localStorage.getItem('paddleLength');
        const savedPaddleSpeed = localStorage.getItem('paddleSpeed');
        if (savedBallSpeed) {
            this.ballSpeedSlider.value = savedBallSpeed;
            this.ballSpeedValue.innerText = savedBallSpeed;
            this.ball.speedX = parseInt(savedBallSpeed) || this.ball.speedX;
            this.ball.speedY = parseInt(savedBallSpeed) || this.ball.speedY;
        }
        if (savedPaddleLength) {
            this.paddleLengthSlider.value = savedPaddleLength;
            this.paddleLengthValue.innerText = savedPaddleLength;
            this.paddle1.height = parseInt(savedPaddleLength) || this.paddle1.height;
            this.paddle2.height = parseInt(savedPaddleLength) || this.paddle2.height;
        }
        if (savedPaddleSpeed) {
            this.paddleSpeedSlider.value = savedPaddleSpeed;
            this.paddleSpeedValue.innerText = savedPaddleSpeed;
            const newSpeed = parseInt(savedPaddleSpeed) || this.paddle1.speed;
            this.paddle1.speed = newSpeed;
            this.paddle2.speed = newSpeed;
        }
    }
    saveSettings() {
        localStorage.setItem('ballSpeed', this.ballSpeedSlider.value);
        localStorage.setItem('paddleLength', this.paddleLengthSlider.value);
        localStorage.setItem('paddleSpeed', this.paddleSpeedSlider.value);
    }
    getBallSpeed() {
        return this.ballSpeedSlider.value || GameConfig.DEFAULT_BALL_SPEED.toString();
    }
    getPaddleLength() {
        return this.paddleLengthSlider.value || GameConfig.DEFAULT_PADDLE_LENGTH.toString();
    }
    getPaddleSpeed() {
        return this.paddleSpeedSlider.value || GameConfig.DEFAULT_PADDLE_SPEED.toString();
    }
}

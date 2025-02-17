import { Ball } from '../classes/Ball';
import { Paddle } from '../classes/Paddle';

interface GameSettings {
	readonly DEFAULT_BALL_SPEED: number;
	readonly DEFAULT_PADDLE_LENGTH: number;
	readonly DEFAULT_PADDLE_SPEED: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
	DEFAULT_BALL_SPEED: 4,
	DEFAULT_PADDLE_LENGTH: 100,
	DEFAULT_PADDLE_SPEED: 5
};


export class SettingsManager {
	private ballSpeedSlider!: HTMLInputElement;
	private ballSpeedValue!: HTMLElement;
	private paddleLengthSlider!: HTMLInputElement;
	private paddleLengthValue!: HTMLElement;
	private paddleSpeedSlider!: HTMLInputElement;
	private paddleSpeedValue!: HTMLElement;

	constructor(
		private ball: Ball,
		private paddle1: Paddle,
		private paddle2: Paddle,
	) {
		this.initializeElements();
		this.setuptEventListeners();
	}

	private initializeElements() {
		try {
			this.ballSpeedSlider = document.getElementById('ball-speed') as HTMLInputElement;
			this.ballSpeedValue = document.getElementById('ball-speed-value')!;
			this.paddleLengthSlider = document.getElementById('paddle-length') as HTMLInputElement;
			this.paddleLengthValue = document.getElementById('paddle-length-value')!;
			this.paddleSpeedSlider = document.getElementById('paddle-speed') as HTMLInputElement;
			this.paddleSpeedValue = document.getElementById('paddle-speed-value')!;
			if (!this.ballSpeedSlider || !this.paddleLengthSlider || !this.paddleSpeedSlider) {
				throw new Error('Required DOM elements not found');
			}
		}
		catch (error) {
			console.error('Failed to initialize settings elements:', error);
			throw error;
		}
	}

	private setuptEventListeners() {
		this.ballSpeedSlider.addEventListener('input', () => {
			this.ballSpeedValue.innerText = this.ballSpeedSlider.value;
			const speed = parseInt(this.ballSpeedSlider.value);
			this.ball.speedX = Math.sign(this.ball.speedX) * speed;
			this.ball.speedY = Math.sign(this.ball.speedY) * speed;
			this.saveSettings();
		});

		this.paddleLengthSlider.addEventListener('input', () => {
			this.paddleLengthValue.innerText = this.paddleLengthSlider.value;
			const newHeight = parseInt(this.paddleLengthSlider.value);
			this.paddle1.updateHeight(newHeight);
			this.paddle2.updateHeight(newHeight);
			this.saveSettings();
		});

		this.paddleSpeedSlider.addEventListener('input', () => {
			this.paddleSpeedValue.innerText = this.paddleSpeedSlider.value;
			this.saveSettings();
		});
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

	public cleanup(): void {
		this.ballSpeedSlider.removeEventListener('input', this.handleBallSpeedChange);
		this.paddleLengthSlider.removeEventListener('input', this.handlePaddleLengthChange);
		this.paddleSpeedSlider.removeEventListener('input', this.handlePaddleSpeedChange);
	}
}
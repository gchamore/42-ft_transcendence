import { SettingsService } from '../services/settingsServices.js';

export class SettingsPage {
	private ballSpeedSlider: HTMLInputElement;
	private ballSpeedValue: HTMLElement;
	private paddleLengthSlider: HTMLInputElement;
	private paddleLengthValue: HTMLElement;
	private paddleSpeedSlider: HTMLInputElement;
	private paddleSpeedValue: HTMLElement;
	private mapSelect: HTMLSelectElement;
	private powerUpsToggle: HTMLInputElement;

	constructor() {
		this.ballSpeedSlider = document.getElementById('ball-speed') as HTMLInputElement;
		this.ballSpeedValue = document.getElementById('ball-speed-value')!;
		this.paddleLengthSlider = document.getElementById('paddle-length') as HTMLInputElement;
		this.paddleLengthValue = document.getElementById('paddle-length-value')!;
		this.paddleSpeedSlider = document.getElementById('paddle-speed') as HTMLInputElement;
		this.paddleSpeedValue = document.getElementById('paddle-speed-value')!;
		this.mapSelect = document.getElementById('map-select') as HTMLSelectElement;
		this.powerUpsToggle = document.getElementById('power-ups-toggle') as HTMLInputElement;

		this.loadSettings();
		this.setupListeners();
	}

	private loadSettings() {
		const settings = SettingsService.loadSettings();

		this.ballSpeedSlider.value = settings.ballSpeed.toString();
		this.ballSpeedValue.textContent = settings.ballSpeed.toString();
		this.paddleSpeedSlider.value = settings.paddleSpeed.toString();
		this.paddleSpeedValue.textContent = settings.paddleSpeed.toString();
		this.paddleLengthSlider.value = settings.paddleLength.toString();
		this.paddleLengthValue.textContent = settings.paddleLength.toString();
		this.mapSelect.value = settings.mapType;
		this.powerUpsToggle.checked = settings.powerUpsEnabled;

		// Set initial values in settings page
	}

	private setupListeners() {
		// Ball speed slider listener
		this.ballSpeedSlider.addEventListener('input', () => {
			this.ballSpeedValue.textContent = this.ballSpeedSlider.value;
			SettingsService.saveSettings(this.getCurrentSettings());
		});

		// Paddle speed slider listener
		this.paddleSpeedSlider.addEventListener('input', () => {
			this.paddleSpeedValue.textContent = this.paddleSpeedSlider.value;
			SettingsService.saveSettings(this.getCurrentSettings());
		});

		// Paddle length slider listener
		this.paddleLengthSlider.addEventListener('input', () => {
			this.paddleLengthValue.textContent = this.paddleLengthSlider.value;
			SettingsService.saveSettings(this.getCurrentSettings());
		});

		// Map type selection listener
		this.mapSelect.addEventListener('change', () => {
			SettingsService.saveSettings(this.getCurrentSettings());
		});

		// Power-ups toggle listener
		this.powerUpsToggle.addEventListener('change', () => {
			SettingsService.saveSettings(this.getCurrentSettings());
		});

		// Start game listener
		document.getElementById('start-game')?.addEventListener('click', () => {
			// Handle starting the game
			window.location.hash = '#game';
		});
	}

	private getCurrentSettings() {
		return {
			ballSpeed: this.ballSpeedSlider.value,
			paddleSpeed: this.paddleSpeedSlider.value,
			paddleLength: this.paddleLengthSlider.value,
			mapType: this.mapSelect.value,
			powerUpsEnabled: this.powerUpsToggle.checked
		};
	}
}

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
	private playerNumber: number = 0;
	private socket!: WebSocket;

	constructor() {
		this.ballSpeedSlider = document.getElementById('ball-speed') as HTMLInputElement;
		this.ballSpeedValue = document.getElementById('ball-speed-value')!;
		this.paddleLengthSlider = document.getElementById('paddle-length') as HTMLInputElement;
		this.paddleLengthValue = document.getElementById('paddle-length-value')!;
		this.paddleSpeedSlider = document.getElementById('paddle-speed') as HTMLInputElement;
		this.paddleSpeedValue = document.getElementById('paddle-speed-value')!;
		this.mapSelect = document.getElementById('map-select') as HTMLSelectElement;
		this.powerUpsToggle = document.getElementById('power-ups-toggle') as HTMLInputElement;

		this.connectWebSocket();
		this.loadSettings();
	}

	private connectWebSocket() {
		this.socket = new WebSocket('ws://localhost:3000/game/settings');
		this.socket.onopen = () => {
			console.log('Settings socket connected');
		};

		this.socket.onmessage = (message) => {
			const data = JSON.parse(message.data);
			if (data.type === 'playerNumber') {
				this.playerNumber = data.playerNumber;
				if (this.playerNumber === 1) {
					const savedSettings = SettingsService.loadSettings();
					this.updateSettings(savedSettings);
					this.setupListeners();
					this.handleSettingsChange();
				}
				else
					this.disableSettings();
			} else if (data.type === 'settingsUpdate') { //server to client
				console.log('received settings update:', data.settings);
				this.updateSettings(data.settings);
			} else if (data.type === 'error') {
				console.error(data.message);
			}
		};
	}

	private async disableSettings() {
        const inputs = [
            this.ballSpeedSlider,
            this.paddleSpeedSlider,
            this.paddleLengthSlider,
            this.mapSelect,
            this.powerUpsToggle
        ];

        inputs.forEach(input => {
            if (input) {
                input.disabled = true;
            }
        });

        const message = document.createElement('p');
        message.textContent = 'Settings are controlled by Player 1';
        message.style.color = 'red';
        document.getElementById('settings-container')?.appendChild(message);
    }

	private handleSettingsChange() {
		const settings = this.getCurrentSettings();
    
		// Save to local storage
		if (this.playerNumber === 1) {
			SettingsService.saveSettings(settings);

			// Send to server if player 1
			if (this.socket.readyState === WebSocket.OPEN) {
				this.socket.send(JSON.stringify({
					type: 'updateSettings', //client to server
					settings: settings
				}));
			}
		}
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
			this.handleSettingsChange();
		});

		// Paddle speed slider listener
		this.paddleSpeedSlider.addEventListener('input', () => {
			this.paddleSpeedValue.textContent = this.paddleSpeedSlider.value;
			this.handleSettingsChange();
		});

		// Paddle length slider listener
		this.paddleLengthSlider.addEventListener('input', () => {
			this.paddleLengthValue.textContent = this.paddleLengthSlider.value;
			this.handleSettingsChange();
		});

		// Map type selection listener
		this.mapSelect.addEventListener('change', () => {
			this.handleSettingsChange();
		});

		// Power-ups toggle listener
		this.powerUpsToggle.addEventListener('change', () => {
			this.handleSettingsChange();
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

	private updateSettings(settings: any) {

		const defaultSettings = {
			ballSpeed: 4,
			paddleSpeed: 4,
			paddleLength: 100,
			mapType: 'default',
			powerUpsEnabled: false
		};
		const safeSettings = { ...defaultSettings, ...settings };
		try { 
			this.ballSpeedSlider.value = safeSettings.ballSpeed.toString();
			this.ballSpeedValue.textContent = safeSettings.ballSpeed.toString();
	
			this.paddleSpeedSlider.value = safeSettings.paddleSpeed.toString();
			this.paddleSpeedValue.textContent = safeSettings.paddleSpeed.toString();
	
			this.paddleLengthSlider.value = safeSettings.paddleLength.toString();
			this.paddleLengthValue.textContent = safeSettings.paddleLength.toString();
	
			this.mapSelect.value = safeSettings.mapType;
			this.powerUpsToggle.checked = safeSettings.powerUpsEnabled;
			console.log('Settings updated successfully');
		} catch (error) {
			console.error('Error updating settings:', error);
			this.updateSettings(defaultSettings);
		}
	}
}

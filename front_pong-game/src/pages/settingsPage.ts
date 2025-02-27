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
	private playerReady: boolean = false;
	private startButton: HTMLButtonElement;
	private lobbyId: string;

	constructor() {
		this.lobbyId = 'lobby-main'
		this.ballSpeedSlider = document.getElementById('ball-speed') as HTMLInputElement;
		this.ballSpeedValue = document.getElementById('ball-speed-value')!;
		this.paddleLengthSlider = document.getElementById('paddle-length') as HTMLInputElement;
		this.paddleLengthValue = document.getElementById('paddle-length-value')!;
		this.paddleSpeedSlider = document.getElementById('paddle-speed') as HTMLInputElement;
		this.paddleSpeedValue = document.getElementById('paddle-speed-value')!;
		this.mapSelect = document.getElementById('map-select') as HTMLSelectElement;
		this.powerUpsToggle = document.getElementById('power-ups-toggle') as HTMLInputElement;
		this.startButton = document.getElementById('start-game') as HTMLButtonElement;
		if (!this.startButton) {
			console.error('Start button not found');
			return;
		}
		
		this.connectWebSocket();
	}

	private connectWebSocket() {
		this.socket = new WebSocket(`ws://localhost:3000/game/${this.lobbyId}`);
		this.socket.onopen = () => {
			console.log('Settings socket connected');
			if (this.playerNumber === 1) {
				this.loadSettings();
			}
		};

		this.socket.onmessage = (message) => {
			const data = JSON.parse(message.data);
			console.log('Received message : ', data);
			switch (data.type) {
				case 'playerNumber':
					this.playerNumber = data.playerNumber;
					if (this.playerNumber === 1) {
						const savedSettings = SettingsService.loadSettings();
						this.updateSettings(savedSettings);
						this.setupListeners();
						this.handleSettingsChange();
					}
					else {
						this.disableSettings();
						this.setupListeners();
					}
					this.updateStartButtonState();
					break;
				case 'settingsUpdate':
					this.updateSettings(data.settings);
					break;
				case 'gameStart':
					if (data.gameId){
					window.location.hash = `#game/${data.gameId}`;
					} else {
						console.error('Game ID not provided');
					}
					break;
				case 'player2Ready':
					if (this.playerNumber === 1) {
						this.startButton.disabled = false;
						this.startButton.textContent = 'Start Game';
					}
					break;
				case 'error':
					console.error(data.message);
					break;
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
		if (this.playerNumber === 1) {
			this.setupSettingsListeners();
		}
		this.setupStartButtonListener();
	}

	private setupSettingsListeners() {
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
	}

	private setupStartButtonListener() {
		// Start game listener
		this.startButton?.addEventListener('click', () => {
			if (this.playerNumber === 2 && !this.playerReady) {
				console.log('Player 2 ready');
				this.playerReady = true;
				this.socket.send(JSON.stringify({
					type: 'playerReady',
					playerNumber: 2
				}));
				this.updateStartButtonState();
			} else if (this.playerNumber === 1 && !this.startButton.disabled) {
				console.log('player 1 ready and requesting game start');
				this.socket.send(JSON.stringify({
					type: 'playerReady',
					playerNumber: 1
				}));
				const gameId = Math.random().toString(36).substring(2, 8);
				this.socket.send(JSON.stringify({
					type: 'startGameRequest',
					gameId: gameId
				}));
			}
		});
	}

	private  updateStartButtonState() {
		if (!this.startButton) return;

		switch (this.playerNumber) {
			case 1:
				this.startButton.textContent = 'Waiting for Player 2...';
				this.startButton.disabled = true;
				break;
			case 2:
				this.startButton.textContent = this.playerReady ? 'Waiting for Player 1...' : 'Ready to Play';
				this.startButton.disabled = this.playerReady;
				break;
			default:
				this.startButton.disabled = true;
				this.startButton.textContent = 'Connecting...';
		}
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

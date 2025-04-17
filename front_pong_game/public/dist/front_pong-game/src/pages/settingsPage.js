var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { SettingsService } from '../services/settingsServices.js';
import { WebSocketService } from '../services/webSocketService.js';
export class SettingsPage {
    constructor(activeGameId) {
        this.playerNumber = 0;
        this.playerReady = false;
        this.lobbyId = activeGameId;
        this.ballSpeedSlider = document.getElementById('ball-speed');
        this.ballSpeedValue = document.getElementById('ball-speed-value');
        this.paddleLengthSlider = document.getElementById('paddle-length');
        this.paddleLengthValue = document.getElementById('paddle-length-value');
        this.paddleSpeedSlider = document.getElementById('paddle-speed');
        this.paddleSpeedValue = document.getElementById('paddle-speed-value');
        this.mapSelect = document.getElementById('map-select');
        this.powerUpsToggle = document.getElementById('power-ups-toggle');
        this.startButton = document.getElementById('start-game');
        if (!this.startButton) {
            console.error('Start button not found');
            return;
        }
        this.connectWebSocket();
    }
    connectWebSocket() {
        this.socket = WebSocketService.getInstance().connect(this.lobbyId, 'lobby');
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
                    WebSocketService.getInstance().setPlayerNumber(data.playerNumber);
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
                    if (data.gameId) {
                        window.location.hash = `game/${data.gameId}`;
                    }
                    else {
                        console.error('Game ID not provided');
                    }
                    break;
                case 'player2Ready':
                    if (this.playerNumber === 1) {
                        this.startButton.disabled = false;
                        this.startButton.textContent = 'Start Game';
                    }
                    break;
                case 'ping':
                    this.socket.send(JSON.stringify({ type: 'pong' }));
                    break;
                case 'error':
                    console.error(data.message);
                    break;
            }
        };
        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.handleConnectionIssues();
        };
        this.socket.onclose = (event) => {
            console.log('WebSocket connection closed:', event.code, event.reason);
            this.handleConnectionIssues();
        };
    }
    handleConnectionIssues() {
        const container = document.getElementById('settings-container');
        if (container) {
            const existingError = document.getElementById('connection-error');
            if (existingError) {
                existingError.remove();
            }
            const error = document.createElement('p');
            error.id = 'connection-error';
            error.textContent = 'Connection to server lost. Please refresh the page.';
            error.style.color = 'red';
            error.style.fontWeight = 'bold';
            container.prepend(error);
        }
        [
            this.ballSpeedSlider,
            this.paddleSpeedSlider,
            this.paddleLengthSlider,
            this.mapSelect,
            this.powerUpsToggle,
            this.startButton
        ].forEach(input => {
            if (input)
                input.disabled = true;
        });
        //redirect to home page
        setTimeout(() => {
            window.location.href = '/';
        }, 3000);
    }
    disableSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
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
            (_a = document.getElementById('settings-container')) === null || _a === void 0 ? void 0 : _a.appendChild(message);
        });
    }
    handleSettingsChange() {
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
    loadSettings() {
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
    setupListeners() {
        if (this.playerNumber === 1) {
            this.setupSettingsListeners();
        }
        this.setupStartButtonListener();
    }
    setupSettingsListeners() {
        // Create bound methods for each listener
        this.handleBallSpeedChange = () => {
            this.ballSpeedValue.textContent = this.ballSpeedSlider.value;
            this.handleSettingsChange();
        };
        this.handlePaddleSpeedChange = () => {
            this.paddleSpeedValue.textContent = this.paddleSpeedSlider.value;
            this.handleSettingsChange();
        };
        this.handlePaddleLengthChange = () => {
            this.paddleLengthValue.textContent = this.paddleLengthSlider.value;
            this.handleSettingsChange();
        };
        this.handleMapChange = () => {
            this.handleSettingsChange();
        };
        this.handlePowerUpsChange = () => {
            this.handleSettingsChange();
        };
        // Attach the listeners
        this.ballSpeedSlider.addEventListener('input', this.handleBallSpeedChange);
        this.paddleSpeedSlider.addEventListener('input', this.handlePaddleSpeedChange);
        this.paddleLengthSlider.addEventListener('input', this.handlePaddleLengthChange);
        this.mapSelect.addEventListener('change', this.handleMapChange);
        this.powerUpsToggle.addEventListener('change', this.handlePowerUpsChange);
    }
    setupStartButtonListener() {
        // Start game listener
        this.startButtonClickHandler = () => {
            if (this.playerNumber === 2 && !this.playerReady) {
                console.log('Player 2 ready');
                this.playerReady = true;
                this.socket.send(JSON.stringify({
                    type: 'playerReady',
                    playerNumber: 2
                }));
                this.updateStartButtonState();
            }
            else if (this.playerNumber === 1 && !this.startButton.disabled) {
                console.log('player 1 ready and requesting game start');
                this.socket.send(JSON.stringify({
                    type: 'playerReady',
                    playerNumber: 1
                }));
                this.socket.send(JSON.stringify({
                    type: 'startGameRequest'
                }));
            }
        };
        this.startButton.addEventListener('click', this.startButtonClickHandler);
    }
    updateStartButtonState() {
        if (!this.startButton)
            return;
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
    getCurrentSettings() {
        return {
            ballSpeed: this.ballSpeedSlider.value,
            paddleSpeed: this.paddleSpeedSlider.value,
            paddleLength: this.paddleLengthSlider.value,
            mapType: this.mapSelect.value,
            powerUpsEnabled: this.powerUpsToggle.checked
        };
    }
    updateSettings(settings) {
        const defaultSettings = {
            ballSpeed: 4,
            paddleSpeed: 5,
            paddleLength: 100,
            mapType: 'default',
            powerUpsEnabled: false
        };
        const safeSettings = Object.assign(Object.assign({}, defaultSettings), settings);
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
        }
        catch (error) {
            console.error('Error updating settings:', error);
            this.updateSettings(defaultSettings);
        }
    }
    cleanup() {
        if (this.ballSpeedSlider)
            this.ballSpeedSlider.removeEventListener('input', this.handleBallSpeedChange);
        if (this.paddleSpeedSlider)
            this.paddleSpeedSlider.removeEventListener('input', this.handlePaddleSpeedChange);
        if (this.paddleLengthSlider)
            this.paddleLengthSlider.removeEventListener('input', this.handlePaddleLengthChange);
        if (this.mapSelect)
            this.mapSelect.removeEventListener('change', this.handleMapChange);
        if (this.powerUpsToggle)
            this.powerUpsToggle.removeEventListener('change', this.handlePowerUpsChange);
        if (this.startButton && this.startButtonClickHandler)
            this.startButton.removeEventListener('click', this.startButtonClickHandler);
    }
}

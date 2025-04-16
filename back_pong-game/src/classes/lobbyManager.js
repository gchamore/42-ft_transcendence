import { SettingsManager } from '../classes/settingsManager.js';
import { safeSend } from '../utils/socketUtils.js';

export class LobbyManager {
	constructor(lobbyId) {
		this.lobbyId = lobbyId;
		this.settingsManager = new SettingsManager();
		this.players = new Map();
	}

	addPlayer(socket, clientId) {
		socket.clientId = clientId;

		if (this.players.size >= 2) {
			console.error(`Lobby ${this.lobbyId} is full. Cannot add client ${clientId} size: ${this.players.size}`);
			return false;
		}

		// If the client reconnects, update their existing connection.
		if (this.players.has(clientId)) {
			const existingSocket = this.players.get(clientId);
			this.players.set(clientId, socket);
			socket.playerNumber = existingSocket.playerNumber;
			console.log(`Client ${clientId} reconnected to lobby ${this.lobbyId}`);
			return true;
		} else {
			const playerNumber = this.players.size + 1;
			socket.playerNumber = playerNumber;
			this.players.set(clientId, socket);
			console.log(`Client ${clientId} joined lobby ${this.lobbyId}`);
			return true;
		}
	}

	removePlayer(clientId) {
		this.players.delete(clientId);
	}

	updateSettings(newSettings) {
		const updatedSettings = this.settingsManager.updateSettings(newSettings);
		this.players.forEach((player) => {
			safeSend(player, {
				type: 'settingsUpdate',
				settings: updatedSettings,
			});
		});
	}

	getSettings() {
		return this.settingsManager.getSettings();
	}
}
import { SettingsManager } from './settingsManager.js';
import { safeSend } from '../utils/socketUtils.js';

export class LobbyManager {
	constructor(lobbyId) {
		this.lobbyId = lobbyId;
		this.settingsManager = new SettingsManager();
		this.players = new Map();
	}

	addPlayer(socket, clientId, playerNumber, fastify) {
		socket.clientId = clientId;
		fastify.log.info('addPlayer clientId:', clientId);

		if (this.players.size >= 2) {
			fastify.log.error(`Lobby ${this.lobbyId} is full. Cannot add client ${clientId} size: ${this.players.size}`);
			return false;
		}

		// If the client reconnects, update their existing connection.
		if (this.players.has(clientId)) {
			this.players.set(clientId, socket);
			socket.playerNumber = playerNumber;
			fastify.log.info(`Client ${clientId} reconnected to lobby ${this.lobbyId}`);
			return true;
		} else {
			socket.playerNumber = playerNumber;
			this.players.set(clientId, socket);
			fastify.log.info(`Client ${clientId} joined lobby ${this.lobbyId}`);
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
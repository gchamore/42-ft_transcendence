import { SettingsManager } from '../classes/settingsManager.js';
import { safeSend } from '../utils/socketUtils.js';

export class LobbyManager {
    constructor(lobbyId) {
        this.lobbyId = lobbyId;
        this.settingsManager = new SettingsManager();
        this.players = [];
    }

    addPlayer(socket) {
        if (this.players.length >= 2) {
            return false; // Lobby is full
        }
        const playerNumber = this.players.length + 1;
        socket.playerNumber = playerNumber;
        this.players.push(socket);
        return true;
    }

    removePlayer(socket) {
        const index = this.players.indexOf(socket);
        if (index > -1) {
            this.players.splice(index, 1);
        }
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
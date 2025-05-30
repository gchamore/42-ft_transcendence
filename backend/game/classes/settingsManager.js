import { GameConfig } from "../shared/config/gameConfig.js";

export class SettingsManager {
	constructor(existingSettings = null) {
		this.settings = existingSettings || {
			ballSpeed: GameConfig.DEFAULT_BALL_SPEED,
			paddleSpeed: GameConfig.DEFAULT_PADDLE_SPEED,
			paddleLength: GameConfig.DEFAULT_PADDLE_LENGTH,
			mapType: GameConfig.DEFAULT_MAP,
			powerUpsEnabled: GameConfig.DEFAULT_POWERUPS,
			maxScore: GameConfig.DEFAULT_MAX_SCORE,
		};
	}

	updateSettings(newSettings) {
		this.settings = { ...this.settings, ...newSettings };
		return this.settings;
	}

	getSettings() {
		return this.settings;
	}
}

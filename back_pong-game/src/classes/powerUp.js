import { GameConfig } from '../../public/dist/shared/config/gameConfig.js';

export class PowerUp {
	constructor(id, type, x, y) {
		this.id = id;
		this.type = type;
		this.x = x;
		this.y = y;
		this.radius = GameConfig.POWERUP_SIZE / 2;
		this.active = false;
		this.activatedBy = null;
		this.activatedTime = null;
		this.duration = GameConfig.POWERUP_DURATION;
	}

	isExpired(currentTime) {
		if (!this.active) return false;
		return currentTime - this.activatedTime >= this.duration;
	}
}

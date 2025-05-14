import { GameConfig } from '../../../../../shared/config/gameConfig.js';

export class CoordinateConverter {
	private readonly scaleX: number = 20 / GameConfig.CANVAS_WIDTH;
	private readonly scaleY: number = 15 / GameConfig.CANVAS_HEIGHT;

	public toScenePosition(gameX: number, gameY: number, yPos: number = -0.2): BABYLON.Vector3 {
		return new BABYLON.Vector3(
			(gameX - GameConfig.CANVAS_WIDTH / 2) * this.scaleX,
			yPos,
			(GameConfig.CANVAS_HEIGHT / 2 - gameY) * this.scaleY
		);
	}

	public getScaleX(): number {
		return this.scaleX;
	}

	public getScaleY(): number {
		return this.scaleY;
	}
}

import { GameConfig } from '../../../../../../shared/config/gameConfig.js';
export class CoordinateConverter {
    constructor() {
        this.scaleX = 20 / GameConfig.CANVAS_WIDTH;
        this.scaleY = 15 / GameConfig.CANVAS_HEIGHT;
    }
    toScenePosition(gameX, gameY, yPos = -0.2) {
        return new BABYLON.Vector3((gameX - GameConfig.CANVAS_WIDTH / 2) * this.scaleX, yPos, (GameConfig.CANVAS_HEIGHT / 2 - gameY) * this.scaleY);
    }
    getScaleX() {
        return this.scaleX;
    }
    getScaleY() {
        return this.scaleY;
    }
}

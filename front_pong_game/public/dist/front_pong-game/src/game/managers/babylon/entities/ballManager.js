import { GameConfig } from "../../../../../../shared/config/gameConfig.js";
export class BallManager {
    constructor(scene, shadowGenerator, ball, coordinateConverter) {
        this.scene = scene;
        this.shadowGenerator = shadowGenerator;
        this.ball = ball;
        this.coordinateConverter = coordinateConverter;
        this.ballMesh = null;
        this.ballCentered = false;
        this.createBallMesh();
    }
    createBallMesh() {
        if (!this.scene)
            return;
        const ballMaterial = new BABYLON.StandardMaterial("ballMaterial", this.scene);
        ballMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
        if (!GameConfig.TEST_MODE) {
            ballMaterial.specularColor = new BABYLON.Color3(1, 1, 1);
            ballMaterial.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        }
        this.ballMesh = BABYLON.MeshBuilder.CreateSphere("ball", {
            diameter: this.ball.radius * 2 * this.coordinateConverter.getScaleX(),
            segments: GameConfig.TEST_MODE ? 8 : 16,
        }, this.scene);
        this.ballMesh.position.y = -0.2;
        this.ballMesh.material = ballMaterial;
        if (this.shadowGenerator && !GameConfig.TEST_MODE) {
            this.shadowGenerator.addShadowCaster(this.ballMesh);
        }
    }
    updatePosition() {
        if (!this.ballMesh)
            return;
        this.ballMesh.position = this.coordinateConverter.toScenePosition(this.ball.x, this.ball.y, -0.2);
    }
    centerBall() {
        if (!this.ballMesh)
            return;
        this.ballMesh.position = this.coordinateConverter.toScenePosition(GameConfig.CANVAS_WIDTH / 2, GameConfig.CANVAS_HEIGHT / 2, -0.2);
        this.ballCentered = true;
    }
    updateDimensions(ballState) {
        var _a;
        if (!this.ballMesh)
            return;
        const originalRadius = (_a = ballState.originalRadius) !== null && _a !== void 0 ? _a : ballState.radius;
        const scaleFactor = ballState.radius / originalRadius;
        this.ballMesh.scaling.x = scaleFactor;
        this.ballMesh.scaling.y = scaleFactor;
        this.ballMesh.scaling.z = scaleFactor;
        this.ballMesh.position = this.coordinateConverter.toScenePosition(ballState.x, ballState.y, -0.2);
    }
    getBallMesh() {
        return this.ballMesh;
    }
    isCentered() {
        return this.ballCentered;
    }
    dispose() {
        if (this.ballMesh) {
            this.ballMesh.dispose();
            this.ballMesh = null;
        }
    }
}

import { Ball } from "../../../classes/ball.js";
import { GameConfig } from "../../../../../../../../shared/config/gameConfig.js";
import { CoordinateConverter } from "../utils/coordinatesConverter.js";

export class BallManager {
	private ballMesh: BABYLON.Mesh | null = null;
	private ballCentered: boolean = false;

	constructor(
		private scene: BABYLON.Scene | null,
		private shadowGenerator: BABYLON.ShadowGenerator | null,
		private ball: Ball,
		private coordinateConverter: CoordinateConverter
	) {
		this.createBallMesh();
	}

	private createBallMesh(): void {
		if (!this.scene) return;

		const ballMaterial = new BABYLON.StandardMaterial("ballMaterial", this.scene);
		ballMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);

		if (!GameConfig.TEST_MODE) {
			ballMaterial.specularColor = new BABYLON.Color3(1, 1, 1);
			ballMaterial.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0.2);
		}

		this.ballMesh = BABYLON.MeshBuilder.CreateSphere(
			"ball",
			{
				diameter: this.ball.radius * 2 * this.coordinateConverter.getScaleX(),
				segments: GameConfig.TEST_MODE ? 8 : 16,
			},
			this.scene
		);

		this.ballMesh.position.y = -0.2;
		this.ballMesh.material = ballMaterial;

		if (this.shadowGenerator && !GameConfig.TEST_MODE) {
			this.shadowGenerator.addShadowCaster(this.ballMesh);
		}
	}

	public updatePosition(): void {
		if (!this.ballMesh) return;

		this.ballMesh.position = this.coordinateConverter.toScenePosition(
			this.ball.x,
			this.ball.y,
			-0.2
		);
	}

	public centerBall(): void {
		if (!this.ballMesh) return;

		this.ballMesh.position = this.coordinateConverter.toScenePosition(
			GameConfig.CANVAS_WIDTH / 2,
			GameConfig.CANVAS_HEIGHT / 2,
			-0.2
		);

		this.ballCentered = true;
	}

	public updateDimensions(ballState: any): void {
		if (!this.ballMesh) return;

		const originalRadius = ballState.originalRadius ?? ballState.radius;
		const scaleFactor = ballState.radius / originalRadius;

		this.ballMesh.scaling.x = scaleFactor;
		this.ballMesh.scaling.y = scaleFactor;
		this.ballMesh.scaling.z = scaleFactor;

		this.ballMesh.position = this.coordinateConverter.toScenePosition(
			ballState.x,
			ballState.y,
			-0.2
		);
	}

	public getBallMesh(): BABYLON.Mesh | null {
		return this.ballMesh;
	}

	public isCentered(): boolean {
		return this.ballCentered;
	}

	public dispose(): void {
		if (this.ballMesh) {
			this.ballMesh.dispose();
			this.ballMesh = null;
		}
	}
}
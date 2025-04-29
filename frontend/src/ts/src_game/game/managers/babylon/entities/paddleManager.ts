import { Paddle } from "../../../classes/paddle.js";
import { GameConfig } from "../../../../../shared/config/gameConfig.js";
import { CoordinateConverter } from "../utils/coordinatesConverter.js";

export class PaddleManager {
	private paddleMesh1: BABYLON.Mesh | null = null;
	private paddleMesh2: BABYLON.Mesh | null = null;

	constructor(
		private scene: BABYLON.Scene | null,
		private shadowGenerator: BABYLON.ShadowGenerator | null,
		private paddle1: Paddle,
		private paddle2: Paddle,
		private coordinateConverter: CoordinateConverter
	) {
		this.createPaddleMeshes();
	}

	private createPaddleMeshes(): void {
		if (!this.scene) return;

		const paddleMaterial = new BABYLON.StandardMaterial("paddleMaterial", this.scene);
		paddleMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);

		if (!GameConfig.TEST_MODE) {
			paddleMaterial.emissiveColor = new BABYLON.Color3(0.5, 0, 1);
			paddleMaterial.specularColor = new BABYLON.Color3(1, 1, 1);
			paddleMaterial.alpha = 0.6;
		}

		const tessellation = GameConfig.TEST_MODE ? 8 : 16;

		// Create paddle 1 mesh
		this.paddleMesh1 = BABYLON.MeshBuilder.CreateCylinder(
			"paddle1",
			{
				diameter: this.paddle1.width * this.coordinateConverter.getScaleX(),
				height: this.paddle1.height * this.coordinateConverter.getScaleY(),
				tessellation: tessellation,
			},
			this.scene
		);
		this.paddleMesh1.rotation.x = Math.PI / 2;
		this.paddleMesh1.material = paddleMaterial.clone("paddleMaterial1");
		this.updatePaddle1Position();

		// Create paddle 2 mesh
		this.paddleMesh2 = BABYLON.MeshBuilder.CreateCylinder(
			"paddle2",
			{
				diameter: this.paddle2.width * this.coordinateConverter.getScaleX(),
				height: this.paddle2.height * this.coordinateConverter.getScaleY(),
				tessellation: tessellation,
			},
			this.scene
		);
		this.paddleMesh2.rotation.x = Math.PI / 2;
		this.paddleMesh2.material = paddleMaterial.clone("paddleMaterial2");
		this.updatePaddle2Position();

		// Add to shadow generator
		if (this.shadowGenerator && !GameConfig.TEST_MODE) {
			this.shadowGenerator.addShadowCaster(this.paddleMesh1);
			this.shadowGenerator.addShadowCaster(this.paddleMesh2);
		}

		// Create glow effect for paddles
		if (!GameConfig.TEST_MODE && this.scene) {
			const glowLayer = new BABYLON.GlowLayer("glow", this.scene);
			glowLayer.intensity = 0.7;
			glowLayer.addIncludedOnlyMesh(this.paddleMesh1);
			glowLayer.addIncludedOnlyMesh(this.paddleMesh2);
		}
	}

	public updatePaddle1Position(): void {
		if (!this.paddleMesh1) return;

		this.paddleMesh1.position = this.coordinateConverter.toScenePosition(
			this.paddle1.x + this.paddle1.width / 2,
			this.paddle1.y,
			-0.5
		);
	}

	public updatePaddle2Position(): void {
		if (!this.paddleMesh2) return;

		this.paddleMesh2.position = this.coordinateConverter.toScenePosition(
			this.paddle2.x + this.paddle2.width / 2,
			this.paddle2.y,
			-0.5
		);
	}

	public updatePositions(): void {
		this.updatePaddle1Position();
		this.updatePaddle2Position();
	}

	public updatePaddle1Dimensions(paddleState: any): void {
		if (!this.paddleMesh1 || !this.scene) return;

		const originalHeight = paddleState.originalHeight ?? paddleState.height;
		const scaleFactor = paddleState.height / originalHeight;
		this.paddleMesh1.scaling.y = scaleFactor;
		this.paddleMesh1.position = this.coordinateConverter.toScenePosition(
			paddleState.x + paddleState.width / 2,
			paddleState.y,
			-0.5
		);
	}

	public updatePaddle2Dimensions(paddleState: any): void {
		if (!this.paddleMesh2 || !this.scene) return;

		const originalHeight = paddleState.originalHeight ?? paddleState.height;
		const scaleFactor = paddleState.height / originalHeight;
		this.paddleMesh2.scaling.y = scaleFactor;
		this.paddleMesh2.position = this.coordinateConverter.toScenePosition(
			paddleState.x + paddleState.width / 2,
			paddleState.y,
			-0.5
		);
	}

	public getPaddle1Mesh(): BABYLON.Mesh | null {
		return this.paddleMesh1;
	}

	public getPaddle2Mesh(): BABYLON.Mesh | null {
		return this.paddleMesh2;
	}

	public dispose(): void {
		if (this.paddleMesh1) {
			this.paddleMesh1.dispose();
			this.paddleMesh1 = null;
		}

		if (this.paddleMesh2) {
			this.paddleMesh2.dispose();
			this.paddleMesh2 = null;
		}
	}
}
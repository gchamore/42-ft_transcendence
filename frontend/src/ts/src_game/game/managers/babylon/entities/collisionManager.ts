import { PaddleManager } from "./paddleManager.js";

export class CollisionManager {
	// Reference to the scene and paddle manager
	private scene: BABYLON.Scene | null;
	private paddleManager: PaddleManager;

	// Flag to enable/disable collision visualization for debugging
	private debugMode: boolean;

	// Collision boxes for debugging visualization
	private paddleCollisionBox1: BABYLON.Mesh | null = null;
	private paddleCollisionBox2: BABYLON.Mesh | null = null;

	constructor(
		scene: BABYLON.Scene | null,
		paddleManager: PaddleManager,
		debugMode: boolean = false
	) {
		this.scene = scene;
		this.paddleManager = paddleManager;
		this.debugMode = debugMode;

		if (debugMode) {
			this.createCollisionBoxes();
		}
	}

	private createCollisionBoxes(): void {
		if (!this.scene) return;

		const invisibleMaterial = new BABYLON.StandardMaterial("debugCollisionMaterial", this.scene);
		invisibleMaterial.diffuseColor = new BABYLON.Color3(1, 0, 0);
		invisibleMaterial.alpha = 0.3;
		invisibleMaterial.wireframe = true;

		// Create visible collision boxes for debugging
		const paddle1Mesh = this.paddleManager.getPaddle1Mesh();
		const paddle2Mesh = this.paddleManager.getPaddle2Mesh();

		if (paddle1Mesh) {
			this.paddleCollisionBox1 = BABYLON.MeshBuilder.CreateBox(
				"paddleCollisionBox1",
				{
					width: paddle1Mesh.scaling.x * 2,
					height: 1,
					depth: paddle1Mesh.scaling.y * 2
				},
				this.scene
			);
			this.paddleCollisionBox1.material = invisibleMaterial;
			this.paddleCollisionBox1.position = paddle1Mesh.position.clone();
		}

		if (paddle2Mesh) {
			this.paddleCollisionBox2 = BABYLON.MeshBuilder.CreateBox(
				"paddleCollisionBox2",
				{
					width: paddle2Mesh.scaling.x * 2,
					height: 1,
					depth: paddle2Mesh.scaling.y * 2
				},
				this.scene
			);
			this.paddleCollisionBox2.material = invisibleMaterial;
			this.paddleCollisionBox2.position = paddle2Mesh.position.clone();
		}
	}

	public updatePositions(): void {
		if (!this.debugMode) return;

		const paddle1Mesh = this.paddleManager.getPaddle1Mesh();
		const paddle2Mesh = this.paddleManager.getPaddle2Mesh();

		if (paddle1Mesh && this.paddleCollisionBox1) {
			this.paddleCollisionBox1.position = paddle1Mesh.position.clone();
			this.paddleCollisionBox1.scaling.x = paddle1Mesh.scaling.x;
			this.paddleCollisionBox1.scaling.z = paddle1Mesh.scaling.y;
		}

		if (paddle2Mesh && this.paddleCollisionBox2) {
			this.paddleCollisionBox2.position = paddle2Mesh.position.clone();
			this.paddleCollisionBox2.scaling.x = paddle2Mesh.scaling.x;
			this.paddleCollisionBox2.scaling.z = paddle2Mesh.scaling.y;
		}
	}

	public toggleDebugMode(enable: boolean): void {
		if (this.debugMode === enable) return;

		this.debugMode = enable;

		if (enable && !this.paddleCollisionBox1) {
			this.createCollisionBoxes();
		} else if (!enable) {
			this.disposeDebugVisuals();
		}

		// Toggle visibility of existing collision boxes
		if (this.paddleCollisionBox1) {
			this.paddleCollisionBox1.isVisible = enable;
		}

		if (this.paddleCollisionBox2) {
			this.paddleCollisionBox2.isVisible = enable;
		}
	}

	private disposeDebugVisuals(): void {
		if (this.paddleCollisionBox1) {
			this.paddleCollisionBox1.dispose();
			this.paddleCollisionBox1 = null;
		}

		if (this.paddleCollisionBox2) {
			this.paddleCollisionBox2.dispose();
			this.paddleCollisionBox2 = null;
		}
	}

	public dispose(): void {
		this.disposeDebugVisuals();
	}
}

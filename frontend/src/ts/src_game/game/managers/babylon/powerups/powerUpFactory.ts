import { GameConfig, PowerUpTypes, PowerUpType } from '../../../../../shared/config/gameConfig.js';
import { CoordinateConverter } from '../utils/coordinatesConverter.js';
import { EffectsManager } from '../effects/effectsManager.js';

export class PowerUpFactory {
	constructor(
		private scene: BABYLON.Scene | null,
		private coordinateConverter: CoordinateConverter,
		private effectsManager: EffectsManager
	) { }

	public createPowerupMesh(powerup: any): Promise<BABYLON.Mesh | null> {
		if (!this.scene || !powerup || !powerup.id) return Promise.resolve(null);

		const position = this.coordinateConverter.toScenePosition(
			powerup.x,
			powerup.y,
			-0.2
		);

		let powerupPath = "";
		let emissiveColor = new BABYLON.Color3(1, 1, 1);

		// Match the original power-up types
		switch (powerup.type) {
			case PowerUpTypes.PADDLE_GROW:
				powerupPath = "mushroom.glb";
				emissiveColor = new BABYLON.Color3(1, 0, 0); // Red
				break;
			case PowerUpTypes.PADDLE_SHRINK:
				powerupPath = "axe.glb";
				emissiveColor = new BABYLON.Color3(1, 1, 0); // Yellow
				break;
			case PowerUpTypes.BALL_GROW:
				powerupPath = "watermelon.glb";
				emissiveColor = new BABYLON.Color3(0, 0.5, 0); // Green
				break;
			case PowerUpTypes.BALL_SHRINK:
				powerupPath = "blueberry.glb";
				emissiveColor = new BABYLON.Color3(1, 0, 1); // Purple
				break;
			case PowerUpTypes.PADDLE_SLOW:
				powerupPath = "turtle.glb";
				emissiveColor = new BABYLON.Color3(0, 0, 1); // Blue
				break;
		}

		return new Promise((resolve) => {
			if (!this.scene) {
				resolve(null);
				return;
			}
			BABYLON.SceneLoader.ImportMesh("", "/assets/models/", powerupPath, this.scene, (meshes) => {
				if (meshes.length > 0 && this.scene) {
					const container = new BABYLON.Mesh(`powerup-${powerup.id}`, this.scene);
					container.position = position;

					// Apply specific rotations based on power-up type
					switch (powerup.type) {
						case PowerUpTypes.PADDLE_SLOW: // Turtle
							const randomDirection = Math.random() < 0.5 ? 1 : -1;
							container.rotation.y = (Math.PI / 2) * randomDirection;
							break;
						case PowerUpTypes.PADDLE_SHRINK: // Axe
							container.rotation.x = Math.PI / 2;
							container.rotation.y = -Math.PI / 2;
							break;
						case PowerUpTypes.BALL_SHRINK: // Blueberry
							container.rotation.x = -Math.PI / 2;
							break;
						case PowerUpTypes.BALL_GROW: // Watermelon
							container.rotation.z = Math.PI / 2;
							break;
						case PowerUpTypes.PADDLE_GROW: // Mushroom
							container.position.y = 0.2;
							container.rotation.x = -Math.PI / 2;
							break;
					}

					for (const mesh of meshes) {
						if (mesh instanceof BABYLON.Mesh) {
							mesh.parent = container;

							// Special handling for the turtle model
							if (powerup.type === PowerUpTypes.PADDLE_SLOW) {
								mesh.position.z += -0.5;
							}
							else if (powerup.type === PowerUpTypes.BALL_GROW) {
								mesh.position.z += 0.5;
							}

							// Apply scaling based on power-up type
							const scaleFactor = this.getScaleFactorForModel(powerup.type);
							mesh.scaling.scaleInPlace(scaleFactor * GameConfig.POWERUP_SIZE / 2);
						}

						// Apply material properties
						if (mesh.material) {
							if (mesh.material instanceof BABYLON.StandardMaterial) {
								mesh.material.emissiveColor = emissiveColor;
								mesh.material.specularPower = 64;
							} else if ((mesh.material as any) instanceof BABYLON.PBRMaterial) {
								const pbrMaterial = mesh.material as BABYLON.PBRMaterial;
								pbrMaterial.emissiveColor = emissiveColor;
								pbrMaterial.emissiveIntensity = 0.6;
							}
						}
					}


					if (GameConfig.TEST_MODE) {
						// Create collision sphere
						this.createCollisionSphere(powerup.id, emissiveColor, position);
					}

					// Add glow effect
					if (!GameConfig.TEST_MODE) {
						this.effectsManager.createPowerupEffect(container);
					}

					resolve(container);
				} else {
					resolve(null);
				}
			});
		});
	}

	private createCollisionSphere(powerupId: number, emissiveColor: BABYLON.Color3, position: BABYLON.Vector3): void {
		if (!this.scene) return;

		const collisionSphere = BABYLON.MeshBuilder.CreateSphere(
			`powerup-collision-${powerupId}`,
			{
				diameter: GameConfig.POWERUP_SIZE * this.coordinateConverter.getScaleX(),
				segments: 16
			},
			this.scene
		);

		const collisionMaterial = new BABYLON.StandardMaterial("collisionMaterial", this.scene);
		collisionMaterial.wireframe = true;
		collisionMaterial.alpha = 0.5;
		collisionMaterial.emissiveColor = emissiveColor;
		collisionSphere.material = collisionMaterial;
		collisionSphere.position = position;
	}

	public getScaleFactorForModel(powerupType: PowerUpType): number {
		const scales = GameConfig.POWERUP_VISUAL_SCALES;
		return scales[powerupType] ?? 0.1;
	}
}
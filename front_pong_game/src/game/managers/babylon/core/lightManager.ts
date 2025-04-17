import { GameConfig } from '../../../../../../shared/config/gameConfig.js';

export class LightManager {
	private light: BABYLON.HemisphericLight | null = null;
	private pointLight: BABYLON.PointLight | null = null;
	private shadowGenerator: BABYLON.ShadowGenerator | null = null;

	constructor(private scene: BABYLON.Scene | null) {
		this.createLights();
	}

	private createLights(): void {
		if (!this.scene) return;

		// Create hemisphere light
		this.light = new BABYLON.HemisphericLight(
			"light",
			new BABYLON.Vector3(0, 1, 0),
			this.scene
		);
		this.light.intensity = 0.7;

		if (!GameConfig.TEST_MODE) {
			// Add a point light for shadow casting
			this.pointLight = new BABYLON.PointLight(
				"pointLight",
				new BABYLON.Vector3(0, 10, -5),
				this.scene
			);
			this.pointLight.intensity = 0.8;

			// Configure shadow generator
			this.shadowGenerator = new BABYLON.ShadowGenerator(
				1024,
				this.pointLight
			);
			this.shadowGenerator.useBlurExponentialShadowMap = true;
			this.shadowGenerator.blurScale = 2;
		}
	}

	public getLight(): BABYLON.HemisphericLight | null {
		return this.light;
	}

	public getPointLight(): BABYLON.PointLight | null {
		return this.pointLight;
	}

	public getShadowGenerator(): BABYLON.ShadowGenerator | null {
		return this.shadowGenerator;
	}

	public addShadowCaster(mesh: BABYLON.Mesh): void {
		if (this.shadowGenerator && !GameConfig.TEST_MODE) {
			this.shadowGenerator.addShadowCaster(mesh);
		}
	}

	public dispose(): void {
		if (this.light) {
			this.light.dispose();
			this.light = null;
		}

		if (this.pointLight) {
			this.pointLight.dispose();
			this.pointLight = null;
		}

		this.shadowGenerator = null; // Shadow generator is disposed with its light
	}
}
export class SceneManager {
	private scene: BABYLON.Scene | null = null;
	private engine: BABYLON.Engine | null = null;

	constructor(engine: BABYLON.Engine) {
		this.engine = engine;
		this.setupScene();
	}

	private setupScene(): void {
		if (!this.engine) return;

		this.scene = new BABYLON.Scene(this.engine);
		if (this.scene) {
			this.scene.clearColor = new BABYLON.Color4(0.05, 0.05, 0.15, 1); // Dark blue
		}
	}

	public getScene(): BABYLON.Scene | null {
		return this.scene;
	}

	public render(): void {
		if (this.scene) {
			this.scene.render();
		}
	}

	public dispose(): void {
		if (this.scene) {
			this.scene.dispose();
			this.scene = null;
		}
	}
}

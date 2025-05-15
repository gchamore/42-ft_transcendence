export class EngineManager {
	private engine: BABYLON.Engine | null = null;

	constructor(private canvas: HTMLCanvasElement) {
		this.createEngine();
	}

	private createEngine(): void {
		try {
			this.engine = new BABYLON.Engine(this.canvas, true);
		} catch (e) {
			// console.error("Error initializing Babylon.js engine", e);
		}
	}

	public getEngine(): BABYLON.Engine {
		if (!this.engine) {
			throw new Error("Engine not initialized");
		}
		return this.engine;
	}

	public resize(): void {
		if (this.engine) {
			this.engine.resize();
		}
	}

	public dispose(): void {
		if (this.engine && !this.engine.isDisposed) {
			this.engine.dispose();
		}
		this.engine = null;
	}
}

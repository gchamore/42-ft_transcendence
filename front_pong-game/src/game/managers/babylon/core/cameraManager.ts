export class CameraManager {
	private camera: BABYLON.ArcRotateCamera | null = null;

	constructor(private scene: BABYLON.Scene | null) {
		this.createCamera();
	}

	private createCamera(): void {
		if (!this.scene) return;

		this.camera = new BABYLON.ArcRotateCamera(
			"camera",
			Math.PI / 2,    // Alpha - rotation around Y-axis
			Math.PI / 3.5,  // Beta - rotation around X-axis
			26,             // Radius - distance from target
			new BABYLON.Vector3(0, 0, 0),
			this.scene
		);

		this.scene.activeCamera = this.camera;
	}

	public getCamera(): BABYLON.ArcRotateCamera | null {
		return this.camera;
	}

	public dispose(): void {
		if (this.camera) {
			this.camera.dispose();
			this.camera = null;
		}
	}
}
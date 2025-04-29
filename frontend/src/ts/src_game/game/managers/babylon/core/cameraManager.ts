export class CameraManager {
	private camera: BABYLON.ArcRotateCamera | null = null;

	constructor(private scene: BABYLON.Scene | null, private playerNumber: number) {
		this.createCamera();
	}

	private createCamera(): void {
		if (!this.scene || !this.playerNumber) return;

		const alpha = this.playerNumber === 1 ? Math.PI : 0 ; // player 1: Math.PI, player 2: 0
		
		this.camera = new BABYLON.ArcRotateCamera(
			"camera",
			alpha,    // Alpha - rotation around Y-axis
			Math.PI / 2.5,  // Beta - rotation around X-axis
			25,             // Radius - distance from target
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
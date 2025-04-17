export class CameraManager {
    constructor(scene) {
        this.scene = scene;
        this.camera = null;
        this.createCamera();
    }
    createCamera() {
        if (!this.scene)
            return;
        this.camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 2, // Alpha - rotation around Y-axis
        Math.PI / 3.5, // Beta - rotation around X-axis
        26, // Radius - distance from target
        new BABYLON.Vector3(0, 0, 0), this.scene);
        this.scene.activeCamera = this.camera;
    }
    getCamera() {
        return this.camera;
    }
    dispose() {
        if (this.camera) {
            this.camera.dispose();
            this.camera = null;
        }
    }
}

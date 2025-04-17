export class SceneManager {
    constructor(engine) {
        this.scene = null;
        this.engine = null;
        this.engine = engine;
        this.setupScene();
    }
    setupScene() {
        if (!this.engine)
            return;
        this.scene = new BABYLON.Scene(this.engine);
        if (this.scene) {
            this.scene.clearColor = new BABYLON.Color4(0.05, 0.05, 0.15, 1); // Dark blue
        }
    }
    getScene() {
        return this.scene;
    }
    render() {
        if (this.scene) {
            this.scene.render();
        }
    }
    dispose() {
        if (this.scene) {
            this.scene.dispose();
            this.scene = null;
        }
    }
}

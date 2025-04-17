export class EngineManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.engine = null;
        this.createEngine();
    }
    createEngine() {
        try {
            this.engine = new BABYLON.Engine(this.canvas, true);
        }
        catch (e) {
            console.error("Error initializing Babylon.js engine", e);
        }
    }
    getEngine() {
        if (!this.engine) {
            throw new Error("Engine not initialized");
        }
        return this.engine;
    }
    resize() {
        if (this.engine) {
            this.engine.resize();
        }
    }
    dispose() {
        if (this.engine && !this.engine.isDisposed) {
            this.engine.dispose();
        }
        this.engine = null;
    }
}

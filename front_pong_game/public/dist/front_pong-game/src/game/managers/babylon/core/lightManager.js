import { GameConfig } from '../../../../../../shared/config/gameConfig.js';
export class LightManager {
    constructor(scene) {
        this.scene = scene;
        this.light = null;
        this.pointLight = null;
        this.shadowGenerator = null;
        this.createLights();
    }
    createLights() {
        if (!this.scene)
            return;
        // Create hemisphere light
        this.light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), this.scene);
        this.light.intensity = 0.7;
        if (!GameConfig.TEST_MODE) {
            // Add a point light for shadow casting
            this.pointLight = new BABYLON.PointLight("pointLight", new BABYLON.Vector3(0, 10, -5), this.scene);
            this.pointLight.intensity = 0.8;
            // Configure shadow generator
            this.shadowGenerator = new BABYLON.ShadowGenerator(1024, this.pointLight);
            this.shadowGenerator.useBlurExponentialShadowMap = true;
            this.shadowGenerator.blurScale = 2;
        }
    }
    getLight() {
        return this.light;
    }
    getPointLight() {
        return this.pointLight;
    }
    getShadowGenerator() {
        return this.shadowGenerator;
    }
    addShadowCaster(mesh) {
        if (this.shadowGenerator && !GameConfig.TEST_MODE) {
            this.shadowGenerator.addShadowCaster(mesh);
        }
    }
    dispose() {
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

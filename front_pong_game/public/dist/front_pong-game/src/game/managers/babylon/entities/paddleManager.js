import { GameConfig } from "../../../../../../shared/config/gameConfig.js";
export class PaddleManager {
    constructor(scene, shadowGenerator, paddle1, paddle2, coordinateConverter) {
        this.scene = scene;
        this.shadowGenerator = shadowGenerator;
        this.paddle1 = paddle1;
        this.paddle2 = paddle2;
        this.coordinateConverter = coordinateConverter;
        this.paddleMesh1 = null;
        this.paddleMesh2 = null;
        this.createPaddleMeshes();
    }
    createPaddleMeshes() {
        if (!this.scene)
            return;
        const paddleMaterial = new BABYLON.StandardMaterial("paddleMaterial", this.scene);
        paddleMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
        if (!GameConfig.TEST_MODE) {
            paddleMaterial.emissiveColor = new BABYLON.Color3(0.5, 0, 1);
            paddleMaterial.specularColor = new BABYLON.Color3(1, 1, 1);
            paddleMaterial.alpha = 0.6;
        }
        const tessellation = GameConfig.TEST_MODE ? 8 : 16;
        // Create paddle 1 mesh
        this.paddleMesh1 = BABYLON.MeshBuilder.CreateCylinder("paddle1", {
            diameter: this.paddle1.width * this.coordinateConverter.getScaleX(),
            height: this.paddle1.height * this.coordinateConverter.getScaleY(),
            tessellation: tessellation,
        }, this.scene);
        this.paddleMesh1.rotation.x = Math.PI / 2;
        this.paddleMesh1.material = paddleMaterial.clone("paddleMaterial1");
        this.updatePaddle1Position();
        // Create paddle 2 mesh
        this.paddleMesh2 = BABYLON.MeshBuilder.CreateCylinder("paddle2", {
            diameter: this.paddle2.width * this.coordinateConverter.getScaleX(),
            height: this.paddle2.height * this.coordinateConverter.getScaleY(),
            tessellation: tessellation,
        }, this.scene);
        this.paddleMesh2.rotation.x = Math.PI / 2;
        this.paddleMesh2.material = paddleMaterial.clone("paddleMaterial2");
        this.updatePaddle2Position();
        // Add to shadow generator
        if (this.shadowGenerator && !GameConfig.TEST_MODE) {
            this.shadowGenerator.addShadowCaster(this.paddleMesh1);
            this.shadowGenerator.addShadowCaster(this.paddleMesh2);
        }
        // Create glow effect for paddles
        if (!GameConfig.TEST_MODE && this.scene) {
            const glowLayer = new BABYLON.GlowLayer("glow", this.scene);
            glowLayer.intensity = 0.7;
            glowLayer.addIncludedOnlyMesh(this.paddleMesh1);
            glowLayer.addIncludedOnlyMesh(this.paddleMesh2);
        }
    }
    updatePaddle1Position() {
        if (!this.paddleMesh1)
            return;
        this.paddleMesh1.position = this.coordinateConverter.toScenePosition(this.paddle1.x + this.paddle1.width / 2, this.paddle1.y, -0.25);
    }
    updatePaddle2Position() {
        if (!this.paddleMesh2)
            return;
        this.paddleMesh2.position = this.coordinateConverter.toScenePosition(this.paddle2.x + this.paddle2.width / 2, this.paddle2.y, -0.25);
    }
    updatePositions() {
        this.updatePaddle1Position();
        this.updatePaddle2Position();
    }
    updatePaddle1Dimensions(paddleState) {
        var _a;
        if (!this.paddleMesh1 || !this.scene)
            return;
        const originalHeight = (_a = paddleState.originalHeight) !== null && _a !== void 0 ? _a : paddleState.height;
        const scaleFactor = paddleState.height / originalHeight;
        this.paddleMesh1.scaling.y = scaleFactor;
        this.paddleMesh1.position = this.coordinateConverter.toScenePosition(paddleState.x + paddleState.width / 2, paddleState.y, -0.25);
    }
    updatePaddle2Dimensions(paddleState) {
        var _a;
        if (!this.paddleMesh2 || !this.scene)
            return;
        const originalHeight = (_a = paddleState.originalHeight) !== null && _a !== void 0 ? _a : paddleState.height;
        const scaleFactor = paddleState.height / originalHeight;
        this.paddleMesh2.scaling.y = scaleFactor;
        this.paddleMesh2.position = this.coordinateConverter.toScenePosition(paddleState.x + paddleState.width / 2, paddleState.y, -0.25);
    }
    getPaddle1Mesh() {
        return this.paddleMesh1;
    }
    getPaddle2Mesh() {
        return this.paddleMesh2;
    }
    dispose() {
        if (this.paddleMesh1) {
            this.paddleMesh1.dispose();
            this.paddleMesh1 = null;
        }
        if (this.paddleMesh2) {
            this.paddleMesh2.dispose();
            this.paddleMesh2 = null;
        }
    }
}

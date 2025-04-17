export class CollisionManager {
    constructor(scene, paddleManager, debugMode = false) {
        // Collision boxes for debugging visualization
        this.paddleCollisionBox1 = null;
        this.paddleCollisionBox2 = null;
        this.scene = scene;
        this.paddleManager = paddleManager;
        this.debugMode = debugMode;
        if (debugMode) {
            this.createCollisionBoxes();
        }
    }
    createCollisionBoxes() {
        if (!this.scene)
            return;
        const invisibleMaterial = new BABYLON.StandardMaterial("debugCollisionMaterial", this.scene);
        invisibleMaterial.diffuseColor = new BABYLON.Color3(1, 0, 0);
        invisibleMaterial.alpha = 0.3;
        invisibleMaterial.wireframe = true;
        // Create visible collision boxes for debugging
        const paddle1Mesh = this.paddleManager.getPaddle1Mesh();
        const paddle2Mesh = this.paddleManager.getPaddle2Mesh();
        if (paddle1Mesh) {
            this.paddleCollisionBox1 = BABYLON.MeshBuilder.CreateBox("paddleCollisionBox1", {
                width: paddle1Mesh.scaling.x * 2,
                height: 1,
                depth: paddle1Mesh.scaling.y * 2
            }, this.scene);
            this.paddleCollisionBox1.material = invisibleMaterial;
            this.paddleCollisionBox1.position = paddle1Mesh.position.clone();
        }
        if (paddle2Mesh) {
            this.paddleCollisionBox2 = BABYLON.MeshBuilder.CreateBox("paddleCollisionBox2", {
                width: paddle2Mesh.scaling.x * 2,
                height: 1,
                depth: paddle2Mesh.scaling.y * 2
            }, this.scene);
            this.paddleCollisionBox2.material = invisibleMaterial;
            this.paddleCollisionBox2.position = paddle2Mesh.position.clone();
        }
    }
    updatePositions() {
        if (!this.debugMode)
            return;
        const paddle1Mesh = this.paddleManager.getPaddle1Mesh();
        const paddle2Mesh = this.paddleManager.getPaddle2Mesh();
        if (paddle1Mesh && this.paddleCollisionBox1) {
            this.paddleCollisionBox1.position = paddle1Mesh.position.clone();
            this.paddleCollisionBox1.scaling.x = paddle1Mesh.scaling.x;
            this.paddleCollisionBox1.scaling.z = paddle1Mesh.scaling.y;
        }
        if (paddle2Mesh && this.paddleCollisionBox2) {
            this.paddleCollisionBox2.position = paddle2Mesh.position.clone();
            this.paddleCollisionBox2.scaling.x = paddle2Mesh.scaling.x;
            this.paddleCollisionBox2.scaling.z = paddle2Mesh.scaling.y;
        }
    }
    toggleDebugMode(enable) {
        if (this.debugMode === enable)
            return;
        this.debugMode = enable;
        if (enable && !this.paddleCollisionBox1) {
            this.createCollisionBoxes();
        }
        else if (!enable) {
            this.disposeDebugVisuals();
        }
        // Toggle visibility of existing collision boxes
        if (this.paddleCollisionBox1) {
            this.paddleCollisionBox1.isVisible = enable;
        }
        if (this.paddleCollisionBox2) {
            this.paddleCollisionBox2.isVisible = enable;
        }
    }
    disposeDebugVisuals() {
        if (this.paddleCollisionBox1) {
            this.paddleCollisionBox1.dispose();
            this.paddleCollisionBox1 = null;
        }
        if (this.paddleCollisionBox2) {
            this.paddleCollisionBox2.dispose();
            this.paddleCollisionBox2 = null;
        }
    }
    dispose() {
        this.disposeDebugVisuals();
    }
}

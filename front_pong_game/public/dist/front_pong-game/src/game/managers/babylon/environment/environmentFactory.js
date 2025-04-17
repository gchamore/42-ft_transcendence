export class EnvironmentFactory {
    constructor(scene) {
        this.scene = scene;
        this.tableMesh = null;
        this.topWall = null;
        this.bottomWall = null;
        this.centerLine = null;
    }
    createTable() {
        if (!this.scene)
            return;
        const tableMaterial = new BABYLON.StandardMaterial("tableMaterial", this.scene);
        tableMaterial.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.3);
        tableMaterial.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        this.tableMesh = BABYLON.MeshBuilder.CreateBox("table", {
            width: 22,
            height: 0.5,
            depth: 15,
        }, this.scene);
        this.tableMesh.position.y = -1;
        this.tableMesh.material = tableMaterial;
        this.tableMesh.receiveShadows = true;
    }
    createWalls() {
        if (!this.scene)
            return;
        const wallMaterial = new BABYLON.StandardMaterial("wallMaterial", this.scene);
        wallMaterial.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.3);
        wallMaterial.alpha = 1;
        // Top wall
        this.topWall = BABYLON.MeshBuilder.CreateBox("topWall", {
            width: 22,
            height: 0.75,
            depth: 0.25,
        }, this.scene);
        this.topWall.position = new BABYLON.Vector3(0, -0.5, 7.75);
        this.topWall.material = wallMaterial;
        // Bottom wall
        this.bottomWall = BABYLON.MeshBuilder.CreateBox("bottomWall", {
            width: 22,
            height: 0.75,
            depth: 0.25,
        }, this.scene);
        this.bottomWall.position = new BABYLON.Vector3(0, -0.5, -7.75);
        this.bottomWall.material = wallMaterial;
    }
    createCenterLine() {
        if (!this.scene)
            return;
        const lineMaterial = new BABYLON.StandardMaterial("lineMaterial", this.scene);
        lineMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
        lineMaterial.alpha = 0.5;
        this.centerLine = BABYLON.MeshBuilder.CreateBox("centerLine", {
            width: 0.2,
            height: 0.1,
            depth: 15,
        }, this.scene);
        this.centerLine.position.y = -0.7;
        this.centerLine.material = lineMaterial;
    }
    getTableMesh() {
        return this.tableMesh;
    }
    getTopWall() {
        return this.topWall;
    }
    getBottomWall() {
        return this.bottomWall;
    }
    dispose() {
        if (this.tableMesh) {
            this.tableMesh.dispose();
            this.tableMesh = null;
        }
        if (this.topWall) {
            this.topWall.dispose();
            this.topWall = null;
        }
        if (this.bottomWall) {
            this.bottomWall.dispose();
            this.bottomWall = null;
        }
        if (this.centerLine) {
            this.centerLine.dispose();
            this.centerLine = null;
        }
    }
}

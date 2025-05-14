export class EnvironmentFactory {
	private tableMesh: BABYLON.Mesh | null = null;
	private topWall: BABYLON.Mesh | null = null;
	private bottomWall: BABYLON.Mesh | null = null;
	private centerLine: BABYLON.Mesh | null = null;
	private obstacle1: BABYLON.Mesh | null = null;
	private obstacle2: BABYLON.Mesh | null = null;

	constructor(
		private scene: BABYLON.Scene | null,
	) { }

	public createTable(): void {
		if (!this.scene) return;

		const tableMaterial = new BABYLON.StandardMaterial("tableMaterial", this.scene);
		tableMaterial.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.3);
		tableMaterial.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);

		this.tableMesh = BABYLON.MeshBuilder.CreatePlane(
			"table",
			{
				width: 22,
				height: 15,
			},
			this.scene
		);
		this.tableMesh.position.y = -1;
		this.tableMesh.rotation.x = Math.PI / 2;
		this.tableMesh.material = tableMaterial;
		this.tableMesh.receiveShadows = true;
	}

	public createWalls(): void {
		if (!this.scene) return;

		const wallMaterial = new BABYLON.StandardMaterial("wallMaterial", this.scene);
		wallMaterial.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.3);
		wallMaterial.alpha = 1;

		// Top wall
		this.topWall = BABYLON.MeshBuilder.CreateBox(
			"topWall",
			{
				width: 22,
				height: 0.75,
				depth: 0.25,
			},
			this.scene
		);
		this.topWall.position = new BABYLON.Vector3(0, -0.8, 7.75);
		this.topWall.material = wallMaterial;

		// Bottom wall
		this.bottomWall = BABYLON.MeshBuilder.CreateBox(
			"bottomWall",
			{
				width: 22,
				height: 0.75,
				depth: 0.25,
			},
			this.scene
		);
		this.bottomWall.position = new BABYLON.Vector3(0, -0.8, -7.75);
		this.bottomWall.material = wallMaterial;
	}

	public createCenterLine(): void {
		if (!this.scene) return;

		const lineMaterial = new BABYLON.StandardMaterial("lineMaterial", this.scene);
		lineMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
		lineMaterial.alpha = 0.5;

		this.centerLine = BABYLON.MeshBuilder.CreateBox(
			"centerLine",
			{
				width: 0.2,
				height: 0.1,
				depth: 15,
			},
			this.scene
		);
		this.centerLine.position.y = -0.7;
		this.centerLine.material = lineMaterial;
	}

	public createCustomMap(): void {
		if (!this.scene) return;

		const customMapMaterial = new BABYLON.StandardMaterial("customMapMaterial", this.scene);
		customMapMaterial.diffuseColor = new BABYLON.Color3(0.5, 0.1, 0.1);
		const hoverHeight = 0.15;

		this.obstacle1 = BABYLON.MeshBuilder.CreateBox("obstacle1", { width: 0.3, height: 0.5, depth: 1.5 }, this.scene);
		this.obstacle1.position = new BABYLON.Vector3(0, hoverHeight, -2.5);
		this.obstacle1.material = customMapMaterial;
		this.obstacle1.receiveShadows = true;
		this.obstacle2 = BABYLON.MeshBuilder.CreateBox("obstacle2", { width: 0.3, height: 0.5, depth: 1.5 }, this.scene);
		this.obstacle2.position = new BABYLON.Vector3(0, hoverHeight, 2.5);
		this.obstacle2.material = customMapMaterial;
		this.obstacle2.receiveShadows = true;
	}

	public getTableMesh(): BABYLON.Mesh | null {
		return this.tableMesh;
	}

	public getTopWall(): BABYLON.Mesh | null {
		return this.topWall;
	}

	public getBottomWall(): BABYLON.Mesh | null {
		return this.bottomWall;
	}

	public dispose(): void {
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

		if (this.obstacle1) {
			this.obstacle1.dispose();
			this.obstacle1 = null;
		}

		if (this.obstacle2) {
			this.obstacle2.dispose();
			this.obstacle2 = null;
		}

	}
}

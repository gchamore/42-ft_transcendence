import {
	Engine,
	Scene,
	Vector3,
	HemisphericLight,
	MeshBuilder,
	StandardMaterial,
	Color3,
	ArcRotateCamera,
	Color4,
	PointLight,
	ShadowGenerator,
} from "babylonjs";
import { Ball } from "../classes/ball.js";
import { Paddle } from "../classes/paddle.js";

export class BabylonManager {
	private engine: Engine | null = null;
	private scene: Scene | null = null;
	private camera: ArcRotateCamera | null = null;
	private light: HemisphericLight | null = null;
	private pointLight: PointLight | null = null;
	private shadowGenerator: ShadowGenerator | null = null;

	private paddleMesh1: any | null = null;
	private paddleMesh2: any | null = null;
	private ballMesh: any | null = null;
	private tableMesh: any | null = null;

	constructor(
		private canvas: HTMLCanvasElement,
		private paddle1: Paddle,
		private paddle2: Paddle,
		private ball: Ball
	) {
		this.setupBabylonScene();
		this.createEnvironment();
		this.createMeshes();
		if (this.engine) {
			this.engine.runRenderLoop(() => {
				this.updateMeshPositions();
				if (this.scene) {
					this.scene.render();
				}
			});
		}

		// Use an instance method for the event listener to enable proper cleanup
		this.handleResize = this.handleResize.bind(this);
		window.addEventListener("resize", this.handleResize);
	}

	private handleResize() {
		if (this.engine) {
			this.engine.resize();
		}
	}

	private setupBabylonScene() {
		this.engine = new Engine(this.canvas, true);
		this.scene = new Scene(this.engine);

		if (!this.scene) return;
		this.scene.clearColor = new Color4(0.05, 0.05, 0.15, 1); // Dark blue

		this.camera = new ArcRotateCamera(
			"camera",
			Math.PI / 2, // Alpha - rotation around Y-axis
			Math.PI / 3.5, // Beta - rotation around X-axis
			22, // Radius - distance from target
			new Vector3(0, 0, 0),
			this.scene
		);
		// allow camera to be controlled by mouse
		this.camera.attachControl(this.canvas, true);
		this.camera.lowerRadiusLimit = 10;
		this.camera.upperRadiusLimit = 40;
		this.camera.lowerBetaLimit = 0.1;
		this.camera.upperBetaLimit = Math.PI / 2.2;

		// add a light to the scene
		this.light = new HemisphericLight(
			"light",
			new Vector3(0, 1, 0),
			this.scene
		);
		this.light.intensity = 0.7;

		// add a point light for shadow casting
		this.pointLight = new PointLight(
			"pointLight",
			new Vector3(0, 10, -5),
			this.scene
		);
		this.pointLight.intensity = 0.8;

		// enable shadows
		this.shadowGenerator = new ShadowGenerator(1024, this.pointLight);
		this.shadowGenerator.useBlurExponentialShadowMap = true;
		this.shadowGenerator.blurScale = 2;
	}

	private createEnvironment(): void {
		if (!this.scene) return;
		const tableMaterial = new StandardMaterial("tableMaterial", this.scene);
		tableMaterial.diffuseColor = new Color3(0.1, 0.1, 0.3);
		tableMaterial.specularColor = new Color3(0.2, 0.2, 0.2);

		this.tableMesh = MeshBuilder.CreateBox(
			"table",
			{
				width: 22,
				height: 0.5,
				depth: 15,
			},
			this.scene
		);
		this.tableMesh.position.y = -1;
		this.tableMesh.material = tableMaterial;
		this.tableMesh.receiveShadows = true;

		const lineMaterial = new StandardMaterial("lineMaterial", this.scene);
		lineMaterial.diffuseColor = new Color3(1, 1, 1);
		lineMaterial.alpha = 0.5;

		const centerLine = MeshBuilder.CreateBox(
			"centerLine",
			{
				width: 0.2,
				height: 0.1,
				depth: 16,
			},
			this.scene
		);
		centerLine.position.y = -0.7;
		centerLine.material = lineMaterial;
	}

	private createMeshes(): void {
		if (!this.scene || !this.shadowGenerator) return;

		const paddleMaterial = new StandardMaterial(
			"paddleMaterial",
			this.scene
		);
		paddleMaterial.diffuseColor = new Color3(1, 1, 1);
		paddleMaterial.specularColor = new Color3(0.2, 0.2, 0.2);

		const ballMaterial = new StandardMaterial("ballMaterial", this.scene);
		ballMaterial.diffuseColor = new Color3(1, 1, 1);
		ballMaterial.specularColor = new Color3(1, 1, 1);
		ballMaterial.emissiveColor = new Color3(0.2, 0.2, 0.2);

		this.paddleMesh1 = MeshBuilder.CreateBox(
			"paddle1",
			{
				width: 0.5,
				height: this.paddle1.height / 40,
				depth: 2,
			},
			this.scene
		);
		this.paddleMesh1.material = paddleMaterial;

		this.paddleMesh2 = MeshBuilder.CreateBox(
			"paddle2",
			{
				width: 0.5,
				height: this.paddle2.height / 40,
				depth: 2,
			},
			this.scene
		);
		this.paddleMesh2.material = paddleMaterial;

		this.ballMesh = MeshBuilder.CreateSphere(
			"ball",
			{
				diameter: this.ball.radius / 5,
				segments: 16,
			},
			this.scene
		);
		this.ballMesh.material = ballMaterial;

		this.shadowGenerator.addShadowCaster(this.paddleMesh1);
		this.shadowGenerator.addShadowCaster(this.paddleMesh2);
		this.shadowGenerator.addShadowCaster(this.ballMesh);

		this.updateMeshPositions();
	}

	private updateMeshPositions(): void {
		if (!this.paddleMesh1 || !this.paddleMesh2 || !this.ballMesh) return;

		const scaleX = 20 / 800;
		const scaleY = 15 / 600;

		this.paddleMesh1.position = new Vector3(
			(this.paddle1.x - 400) * scaleX,
			-0.25,
			(300 - this.paddle1.y - this.paddle1.height / 2) * scaleY
		);

		this.paddleMesh2.position = new Vector3(
			(this.paddle2.x - 400) * scaleX,
			-0.25,
			(300 - this.paddle2.y - this.paddle2.height / 2) * scaleY
		);

		this.ballMesh.position = new Vector3(
			(this.ball.x - 400) * scaleX,
			0,
			(300 - this.ball.y) * scaleY
		);
	}

	dispose(): void {
		// Remove event listener using the bound method
		window.removeEventListener("resize", this.handleResize);

		if (this.engine && !this.engine.isDisposed) {
			this.engine.dispose();
		}

		// Nullify references to help garbage collection
		this.engine = null;
		this.scene = null;
		this.camera = null;
		this.light = null;
		this.pointLight = null;
		this.shadowGenerator = null;
		this.paddleMesh1 = null;
		this.paddleMesh2 = null;
		this.ballMesh = null;
		this.tableMesh = null;
	}
}

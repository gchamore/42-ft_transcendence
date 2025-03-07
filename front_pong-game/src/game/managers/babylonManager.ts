/// <reference path="../../types/babylon.d.ts" />
import { Ball } from "../classes/ball.js";
import { Paddle } from "../classes/paddle.js";

export class BabylonManager {
	private engine: BABYLON.Engine | null = null;
	private scene: BABYLON.Scene | null = null;
	private camera: BABYLON.ArcRotateCamera | null = null;
	private light: BABYLON.HemisphericLight | null = null;
	private pointLight: BABYLON.PointLight | null = null;
	private shadowGenerator: BABYLON.ShadowGenerator | null = null;

	private paddleMesh1: any | null = null;
	private paddleMesh2: any | null = null;
	private ballMesh: any | null = null;
	private tableMesh: any | null = null;
	private loadingScreen: HTMLElement | null = null;
	private lastRenderTime: number = 0;
	private readonly frameInterval: number = 1000 / 60; // ~16.7ms for 60fps

	constructor(
		private canvas: HTMLCanvasElement,
		private paddle1: Paddle,
		private paddle2: Paddle,
		private ball: Ball,
		private onLoadingComplete?: () => void
	) {
		this.showLoadingScreen();
		this.setupBabylonScene();
		this.createEnvironment();
		this.createMeshes();
		if (this.engine) {
			this.lastRenderTime = performance.now();
			if (this.scene) {
				this.scene.render();
			}
			setTimeout(() => {
				this.hideLoadingScreen();
				if (this.onLoadingComplete) {
					this.onLoadingComplete();
				}
			}, 1000);
		} else {
			this.hideLoadingScreen();
		}

		// Use an instance method for the event listener to enable proper cleanup
		this.handleResize = this.handleResize.bind(this);
		window.addEventListener("resize", this.handleResize);
	}

	public render(timestamp: number): void {
		if (!this.engine || !this.scene) return;
		const elapsed = timestamp - this.lastRenderTime;
		if (elapsed > this.frameInterval) {
			this.lastRenderTime = timestamp;

			// this.updateMeshPositions();
			this.scene.render();
			this.lastRenderTime = timestamp - (elapsed % this.frameInterval);
		}
	}

	public getEngine() {
		return {
			getFps: () => 60,
			isDisposed: false,
		};
		return this.engine;
	}

	private showLoadingScreen() {
		this.loadingScreen = document.createElement("div");
		this.loadingScreen.id = "babylon-loading-screen";

		const titleElement = document.createElement("div");
		titleElement.id = "loading-title";
		titleElement.textContent = "Loading 3D Scene...";

		const spinnerElement = document.createElement("div");
		spinnerElement.id = "loading-spinner";

		this.loadingScreen.appendChild(titleElement);
		this.loadingScreen.appendChild(spinnerElement);

		const gameContainer = document.getElementById("game-container");
		if (gameContainer) {
			gameContainer.appendChild(this.loadingScreen);
		} else {
			document.body.appendChild(this.loadingScreen);
		}
	}

	private hideLoadingScreen() {
		if (this.loadingScreen) {
			// Fade out the loading screen
			this.loadingScreen.style.opacity = "0";

			// Remove after transition completes
			setTimeout(() => {
				if (this.loadingScreen && this.loadingScreen.parentNode) {
					this.loadingScreen.parentNode.removeChild(
						this.loadingScreen
					);
				}
				this.loadingScreen = null;
			}, 500);
		}
	}

	private handleResize() {
		if (this.engine) {
			this.engine.resize();
		}
	}

	private setupBabylonScene() {
		try {
			this.engine = new BABYLON.Engine(this.canvas, true);
			this.scene = new BABYLON.Scene(this.engine);

			if (!this.scene) return;
			this.scene.clearColor = new BABYLON.Color4(0.05, 0.05, 0.15, 1); // Dark blue

			this.camera = new BABYLON.ArcRotateCamera(
				"camera",
				Math.PI / 2, // Alpha - rotation around Y-axis
				Math.PI / 3.5, // Beta - rotation around X-axis
				22, // Radius - distance from target
				new BABYLON.Vector3(0, 0, 0),
				this.scene
			);
			// allow camera to be controlled by mouse
			this.camera.attachControl(this.canvas, true);
			this.camera.lowerRadiusLimit = 10;
			this.camera.upperRadiusLimit = 40;
			this.camera.lowerBetaLimit = 0.1;
			this.camera.upperBetaLimit = Math.PI / 2.2;

			// add a light to the scene
			this.light = new BABYLON.HemisphericLight(
				"light",
				new BABYLON.Vector3(0, 1, 0),
				this.scene
			);
			this.light.intensity = 0.7;

			// add a point light for shadow casting
			this.pointLight = new BABYLON.PointLight(
				"pointLight",
				new BABYLON.Vector3(0, 10, -5),
				this.scene
			);
			this.pointLight.intensity = 0.8;

			// enable shadows
			this.shadowGenerator = new BABYLON.ShadowGenerator(1024, this.pointLight);
			this.shadowGenerator.useBlurExponentialShadowMap = true;
			this.shadowGenerator.blurScale = 2;
		} catch (e) {
			console.error("Error initializing Babylon.js", e);
		}
	}

	private createEnvironment(): void {
		if (!this.scene) return;
		const tableMaterial = new BABYLON.StandardMaterial("tableMaterial", this.scene);
		tableMaterial.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.3);
		tableMaterial.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);

		this.tableMesh = BABYLON.MeshBuilder.CreateBox(
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

		const lineMaterial = new BABYLON.StandardMaterial("lineMaterial", this.scene);
		lineMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
		lineMaterial.alpha = 0.5;

		const centerLine = BABYLON.MeshBuilder.CreateBox(
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

		const paddleMaterial = new BABYLON.StandardMaterial(
			"paddleMaterial",
			this.scene
		);
		paddleMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
		paddleMaterial.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);

		const ballMaterial = new BABYLON.StandardMaterial("ballMaterial", this.scene);
		ballMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
		ballMaterial.specularColor = new BABYLON.Color3(1, 1, 1);
		ballMaterial.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0.2);

		this.paddleMesh1 = BABYLON.MeshBuilder.CreateBox(
			"paddle1",
			{
				width: 0.5,
				height: this.paddle1.height / 40,
				depth: 2,
			},
			this.scene
		);
		this.paddleMesh1.material = paddleMaterial;

		this.paddleMesh2 = BABYLON.MeshBuilder.CreateBox(
			"paddle2",
			{
				width: 0.5,
				height: this.paddle2.height / 40,
				depth: 2,
			},
			this.scene
		);
		this.paddleMesh2.material = paddleMaterial;

		this.ballMesh = BABYLON.MeshBuilder.CreateSphere(
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

		// this.updateMeshPositions();
	}

	// private updateMeshPositions(): void {
	// 	if (!this.paddleMesh1 || !this.paddleMesh2 || !this.ballMesh) return;

	// 	const scaleX = 20 / 800;
	// 	const scaleY = 15 / 600;

	// 	this.paddleMesh1.position = new BABYLON.Vector3(
	// 		(this.paddle1.x - 400) * scaleX,
	// 		-0.25,
	// 		(300 - this.paddle1.y - this.paddle1.height / 2) * scaleY
	// 	);

	// 	this.paddleMesh2.position = new BABYLON.Vector3(
	// 		(this.paddle2.x - 400) * scaleX,
	// 		-0.25,
	// 		(300 - this.paddle2.y - this.paddle2.height / 2) * scaleY
	// 	);

	// 	this.ballMesh.position = new BABYLON.Vector3(
	// 		(this.ball.x - 400) * scaleX,
	// 		0,
	// 		(300 - this.ball.y) * scaleY
	// 	);
	// }

	dispose(): void {
		this.hideLoadingScreen();
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

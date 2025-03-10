/// <reference path="../../types/babylon.d.ts" />
import { Ball } from "../classes/ball.js";
import { Paddle } from "../classes/paddle.js";
import { TEST_MODE } from "../../utils/config/gameConfig.js";

const TARGET_FPS = 30;

export class BabylonManager {
	private engine: BABYLON.Engine | null = null;
	private scene: BABYLON.Scene | null = null;
	private camera: BABYLON.ArcRotateCamera | null = null;
	private light: BABYLON.HemisphericLight | null = null;
	private pointLight: BABYLON.PointLight | null = null;
	private shadowGenerator: BABYLON.ShadowGenerator | null = null;

	private paddleMesh1: BABYLON.Mesh | null = null;
	private paddleMesh2: BABYLON.Mesh | null = null;
	private ballMesh: BABYLON.Mesh | null = null;
	private tableMesh: BABYLON.Mesh | null = null;
	private loadingScreen: HTMLElement | null = null;
	private lastRenderTime: number = 0;
	private readonly frameInterval: number = 1000 / TARGET_FPS; 

	private targetPaddle1Pos: BABYLON.Vector3 | null = null;
	private targetPaddle2Pos: BABYLON.Vector3 | null = null;
	private targetBallPos: BABYLON.Vector3 | null = null;

	constructor(
		private canvas: HTMLCanvasElement,
		private paddle1: Paddle,
		private paddle2: Paddle,
		private ball: Ball,
		private playerNumber: number = 1,
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

			this.updateMeshPositions();
			this.scene.render();
			this.lastRenderTime = timestamp - (elapsed % this.frameInterval);
		}
	}

	public getEngine() {
		return {
			getFps: () => 30,
			isDisposed: false,
		};
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
				26, // Radius - distance from target
				new BABYLON.Vector3(0, 0, 0),
				this.scene
			);
			this.scene.activeCamera = this.camera;

			// add a light to the scene
			this.light = new BABYLON.HemisphericLight(
				"light",
				new BABYLON.Vector3(0, 1, 0),
				this.scene
			);
			this.light.intensity = 0.7;

			if (!TEST_MODE) {
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
			}
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
				depth: 15,
			},
			this.scene
		);
		centerLine.position.y = -0.7;
		centerLine.material = lineMaterial;
	}

	private createMeshes(): void {
		if (!this.scene) return;

		const paddleMaterial = new BABYLON.StandardMaterial("paddleMaterial", this.scene);
		paddleMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
		if (!TEST_MODE) {
			paddleMaterial.emissiveColor = new BABYLON.Color3(0.5, 0, 1);
			paddleMaterial.specularColor = new BABYLON.Color3(1, 1, 1);
			paddleMaterial.alpha = 0.6;
		}

		const ballMaterial = new BABYLON.StandardMaterial("ballMaterial", this.scene);
		ballMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
		if (!TEST_MODE) {
			ballMaterial.specularColor = new BABYLON.Color3(1, 1, 1);
			ballMaterial.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0.2);
		}

		const scaleX = 20 / 800;
		const scaleY = 15 / 600;
		const tessellation = TEST_MODE ? 8 : 16;

		this.paddleMesh1 = BABYLON.MeshBuilder.CreateCylinder(
			"paddle1",
			{
				diameter: 1.2,
				height: this.paddle1.height / 40,
				tessellation: tessellation,
			},
			this.scene
		);
		this.paddleMesh1.rotation.x = Math.PI / 2;
		this.paddleMesh1.material = paddleMaterial;
		this.paddleMesh1.position = new BABYLON.Vector3(
			(this.paddle1.x - 400) * scaleX,
			-0.25,
			(300 - this.paddle1.y - this.paddle1.height / 2) * scaleY
		);

		this.paddleMesh2 = BABYLON.MeshBuilder.CreateCylinder(
			"paddle2",
			{
				diameter: 1.2,
				height: this.paddle1.height / 40,
				tessellation: tessellation,
			},
			this.scene
		);
		this.paddleMesh2.rotation.x = Math.PI / 2;
		this.paddleMesh2.material = paddleMaterial;
		this.paddleMesh2.position = new BABYLON.Vector3(
			(this.paddle2.x - 400) * scaleX,
			-0.25,
			(300 - this.paddle2.y - this.paddle2.height / 2) * scaleY
		);

		this.ballMesh = BABYLON.MeshBuilder.CreateSphere(
			"ball",
			{
				diameter: this.ball.radius / 5,
				segments: 16,
			},
			this.scene
		);
		this.ballMesh.material = ballMaterial;

		if (!TEST_MODE && this.shadowGenerator) {
			this.shadowGenerator.addShadowCaster(this.paddleMesh1);
			this.shadowGenerator.addShadowCaster(this.paddleMesh2);
			this.shadowGenerator.addShadowCaster(this.ballMesh);
		}

		if (!TEST_MODE) {
			const glowLayer = new BABYLON.GlowLayer("glow", this.scene);
			glowLayer.intensity = 0.7;
			glowLayer.addIncludedOnlyMesh(this.paddleMesh1);
			glowLayer.addIncludedOnlyMesh(this.paddleMesh2);
		}

	}

	private updateMeshPositions(): void {
		if (!this.paddleMesh1 || !this.paddleMesh2 || !this.ballMesh) return;

		const scaleX = 20 / 800;
		const scaleY = 15 / 600;

		// Calculate target positions
		this.targetPaddle1Pos = new BABYLON.Vector3(
			(this.paddle1.x - 400) * scaleX,
			-0.25,
			(300 - this.paddle1.y - this.paddle1.height / 2) * scaleY
		);

		this.targetPaddle2Pos = new BABYLON.Vector3(
			(this.paddle2.x - 400) * scaleX,
			-0.25,
			(300 - this.paddle2.y - this.paddle2.height / 2) * scaleY
		);

		this.targetBallPos = new BABYLON.Vector3(
			(this.ball.x - 400) * scaleX,
			0,
			(300 - this.ball.y) * scaleY
		);

		// Use different interpolation factors based on whether it's local or remote
		// Local player's paddle (more responsive)
		const localPaddleInterp = 0.3; 
		// Remote player's paddle (smoother)
		const remotePaddleInterp = 0.15;
		// Ball interpolation
		const ballInterp = 0.2;
		
	
		
		// Apply interpolation differently based on which paddle is controlled locally
		if (this.playerNumber === 1) {
			// Player 1's paddle (local - more responsive)
			this.paddleMesh1.position = BABYLON.Vector3.Lerp(
				this.paddleMesh1.position,
				this.targetPaddle1Pos,
				localPaddleInterp
			);
			
			// Player 2's paddle (remote - smoother)
			this.paddleMesh2.position = BABYLON.Vector3.Lerp(
				this.paddleMesh2.position,
				this.targetPaddle2Pos,
				remotePaddleInterp
			);
		} else {
			// Player 1's paddle (remote - smoother) 
			this.paddleMesh1.position = BABYLON.Vector3.Lerp(
				this.paddleMesh1.position,
				this.targetPaddle1Pos,
				remotePaddleInterp
			);
			
			// Player 2's paddle (local - more responsive)
			this.paddleMesh2.position = BABYLON.Vector3.Lerp(
				this.paddleMesh2.position,
				this.targetPaddle2Pos,
				localPaddleInterp
			);
		}
		
		// Ball always uses medium interpolation
		this.ballMesh.position = BABYLON.Vector3.Lerp(
			this.ballMesh.position,
			this.targetBallPos,
			ballInterp
		);
	}

	public handlePaddleHit(paddle: BABYLON.Mesh): void {
		if (!this.scene || TEST_MODE) return;
		const flash = new BABYLON.PointLight("flash", paddle.position, this.scene);
		flash.intensity = 3;
		flash.diffuseColor = new BABYLON.Color3(1, 0.5, 0);

		setTimeout(() => {
			flash.intensity = 0;
			flash.dispose();
		}, 200);
	}

	// public handleWallHit(position: { x: number; y: number }): void {
	// 	if (!this.scene) return;
	// 	const flash = new BABYLON.PointLight(
	// 		"wallHit",
	// 		new BABYLON.Vector3(
	// 			(position.x - 400) * (20 / 800),
	// 			0,
	// 			(300 - position.y) * (15 / 600)
	// 		),
	// 		this.scene
	// 	);
	// 	flash.intensity = 2;
	// 	flash.diffuseColor = new BABYLON.Color3(0.2, 0.2, 1);

	// 	setTimeout(() => {
	// 		flash.dispose();
	// 	}, 150);
	// }

	// public handleScoreEffect(scorer: number, position: { x: number; y: number }): void {
	// 	if (!this.scene) return;
	// 	const glowLayer = new BABYLON.GlowLayer("scoreGlow", this.scene);
	// 	const scoreMesh = BABYLON.MeshBuilder.CreateSphere(
	// 		"scoreEffect",
	// 		{ diameter: 2 },
	// 		this.scene
	// 	);
	// 	scoreMesh.position = new BABYLON.Vector3(
	// 		(position.x - 400) * (20 / 800),
	// 		0,
	// 		(300 - position.y) * (15 / 600)
	// 	);

	// 	const material = new BABYLON.StandardMaterial("scoreMaterial", this.scene);
	// 	material.emissiveColor = scorer === 1 ?
	// 		new BABYLON.Color3(1, 0, 0) :
	// 		new BABYLON.Color3(0, 0, 1);
	// 		scoreMesh.material = material;

	// 	setTimeout(() => {
	// 		glowLayer.dispose();
	// 		scoreMesh.dispose();
	// 	}, 1000);
	// }

	// public handleGameStartAnimation(): void {
	// 	if (!this.scene) return;
	// 	const numbers = ['3', '2', '1', 'GO!'];
	// 	let i = 0;
	// 	const interval = setInterval(() => {
	// 		if (i >= numbers.length) {
	// 			clearInterval(interval);
	// 			return;
	// 		}
	// 		if (this.scene) {
	// 			const text = BABYLON.MeshBuilder.CreateText(
	// 				"countdown",
	// 				numbers[i],
	// 				null,
	// 				this.scene
	// 			);
	// 			setTimeout(() => text.dispose(), 900);
	// 		}
	// 		i++;
	// 	}, 1000);
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

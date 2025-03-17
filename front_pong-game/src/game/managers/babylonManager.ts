/// <reference path="../../types/babylon.d.ts" />
import { Ball } from "../classes/ball.js";
import { Paddle } from "../classes/paddle.js";
import { GameState } from "@shared/types/gameState";
import { GameConfig } from "../../../../shared/config/gameConfig.js";

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
	private topWall: BABYLON.Mesh | null = null;
	private bottomWall: BABYLON.Mesh | null = null;
	private loadingScreen: HTMLElement | null = null;

	private readonly frameInterval: number = 1000 / GameConfig.TARGET_FPS;
	private readonly scaleX: number = 20 / GameConfig.CANVAS_WIDTH;
	private readonly scaleY: number = 15 / GameConfig.CANVAS_HEIGHT;

	private previousSpeedX: number = 0;
	private previousSpeedY: number = 0;
	private gameStarted: boolean = false;
	private ballCentered: boolean = false;

	private lastRenderTime: number = 0;
	private lastServerUpdate: number = 0;

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
				this.render(this.lastRenderTime);
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

			if (!GameConfig.TEST_MODE) {
				// add a point light for shadow casting
				this.pointLight = new BABYLON.PointLight(
					"pointLight",
					new BABYLON.Vector3(0, 10, -5),
					this.scene
				);
				this.pointLight.intensity = 0.8;

				// enable shadows
				this.shadowGenerator = new BABYLON.ShadowGenerator(
					1024,
					this.pointLight
				);
				this.shadowGenerator.useBlurExponentialShadowMap = true;
				this.shadowGenerator.blurScale = 2;
			}
		} catch (e) {
			console.error("Error initializing Babylon.js", e);
		}
	}

	private createEnvironment(): void {
		if (!this.scene) return;
		const tableMaterial = new BABYLON.StandardMaterial(
			"tableMaterial",
			this.scene
		);
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

		const wallMaterial = new BABYLON.StandardMaterial(
			"wallMaterial",
			this.scene
		);
		wallMaterial.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.3);
		wallMaterial.alpha = 0.7;

		this.topWall = BABYLON.MeshBuilder.CreateBox(
			"topWall",
			{
				width: 22,
				height: 0.75,
				depth: 0.25,
			},
			this.scene
		);
		this.topWall.position = new BABYLON.Vector3(0, -0.5, 7.75);
		this.topWall.material = wallMaterial;

		this.bottomWall = BABYLON.MeshBuilder.CreateBox(
			"bottomWall",
			{
				width: 22,
				height: 0.75,
				depth: 0.25,
			},
			this.scene
		);
		this.bottomWall.position = new BABYLON.Vector3(0, -0.5, -7.75);
		this.bottomWall.material = wallMaterial;

		const lineMaterial = new BABYLON.StandardMaterial(
			"lineMaterial",
			this.scene
		);
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

		const paddleMaterial = new BABYLON.StandardMaterial(
			"paddleMaterial",
			this.scene
		);
		paddleMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
		if (!GameConfig.TEST_MODE) {
			paddleMaterial.emissiveColor = new BABYLON.Color3(0.5, 0, 1);
			paddleMaterial.specularColor = new BABYLON.Color3(1, 1, 1);
			paddleMaterial.alpha = 0.6;
		}

		const scaleX = 20 / GameConfig.CANVAS_WIDTH;
		const scaleY = 15 / GameConfig.CANVAS_HEIGHT;
		const tessellation = GameConfig.TEST_MODE ? 8 : 16;

		this.paddleMesh1 = BABYLON.MeshBuilder.CreateCylinder(
			"paddle1",
			{
				diameter: this.paddle1.width * scaleX,
				height: this.paddle1.height * scaleY,
				tessellation: tessellation,
			},
			this.scene
		);
		this.paddleMesh1.rotation.x = Math.PI / 2;
		this.paddleMesh1.material = paddleMaterial;
		this.paddleMesh1.position = new BABYLON.Vector3(
			(this.paddle1.x + this.paddle1.width / 2 - (GameConfig.CANVAS_WIDTH / 2)) * scaleX, // Center of paddle
			-0.25,
			((GameConfig.CANVAS_HEIGHT / 2) - this.paddle1.y) * scaleY
		);

		this.paddleMesh2 = BABYLON.MeshBuilder.CreateCylinder(
			"paddle2",
			{
				diameter: this.paddle2.width * scaleX,
				height: this.paddle2.height * scaleY,
				tessellation: tessellation,
			},
			this.scene
		);
		this.paddleMesh2.rotation.x = Math.PI / 2;
		this.paddleMesh2.material = paddleMaterial;
		this.paddleMesh2.position = new BABYLON.Vector3(
			(this.paddle2.x + this.paddle2.width / 2 - (GameConfig.CANVAS_WIDTH / 2)) * scaleX, // Center of paddle
			-0.25,
			((GameConfig.CANVAS_HEIGHT / 2) - this.paddle2.y) * scaleY
		);

		const ballMaterial = new BABYLON.StandardMaterial(
			"ballMaterial",
			this.scene
		);
		ballMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
		if (!GameConfig.TEST_MODE) {
			ballMaterial.specularColor = new BABYLON.Color3(1, 1, 1);
			ballMaterial.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0.2);
		}

		this.ballMesh = BABYLON.MeshBuilder.CreateSphere(
			"ball",
			{
				diameter: this.ball.radius * 2 * scaleX,
				segments: GameConfig.TEST_MODE ? 8 : 16,
			},
			this.scene
		);
		this.ballMesh.position.y = -0.2;
		this.ballMesh.material = ballMaterial;

		if (!GameConfig.TEST_MODE && this.shadowGenerator) {
			this.shadowGenerator.addShadowCaster(this.paddleMesh1);
			this.shadowGenerator.addShadowCaster(this.paddleMesh2);
			this.shadowGenerator.addShadowCaster(this.ballMesh);
			this.shadowGenerator.addShadowCaster(this.bottomWall);
			this.shadowGenerator.addShadowCaster(this.topWall);
		}

		if (!GameConfig.TEST_MODE) {
			const glowLayer = new BABYLON.GlowLayer("glow", this.scene);
			glowLayer.intensity = 0.7;
			glowLayer.addIncludedOnlyMesh(this.paddleMesh1);
			glowLayer.addIncludedOnlyMesh(this.paddleMesh2);
		}
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

	public renderLocalPaddle(): void {
		if (!this.engine || !this.scene) return;
		this.updatePaddleMeshPositions();
		if (!this.gameStarted) {
			this.scene.render();
		}
	}

	public updateGameState(gameState: GameState) {
		this.lastServerUpdate = performance.now();
		this.gameStarted = gameState.gameStarted;
		if (this.gameStarted && this.ballCentered) {
			this.ballCentered = false;
		}
	}

	private updateMeshPositions(): void {
		this.updatePaddleMeshPositions();
		if (this.gameStarted) {
			this.updateBallMeshPosition();
		} else if (!this.ballCentered && !this.gameStarted) {
			this.ballCentered = true;
			this.centerBallPosition();
		}
	}

	private centerBallPosition(): void {
		if (!this.ballMesh) return;
		this.ballMesh.position = new BABYLON.Vector3(0, -0.2, 0);
		this.previousSpeedX = 0;
		this.previousSpeedY = 0;
	}

	private updatePaddleMeshPositions(): void {
		if (!this.paddleMesh1 || !this.paddleMesh2) return;

		this.paddleMesh1.position = new BABYLON.Vector3(
			(this.paddle1.x + this.paddle1.width / 2 - (GameConfig.CANVAS_WIDTH / 2)) * this.scaleX,
			-0.25,
			((GameConfig.CANVAS_HEIGHT / 2) - this.paddle1.y) * this.scaleY
		);

		this.paddleMesh2.position = new BABYLON.Vector3(
			(this.paddle2.x + this.paddle2.width / 2 - (GameConfig.CANVAS_WIDTH / 2)) * this.scaleX,
			-0.25,
			((GameConfig.CANVAS_HEIGHT / 2) - this.paddle2.y) * this.scaleY
		);
	}

	private updateBallMeshPosition(): void {
		if (!this.ballMesh) return;
		const now = performance.now();
		const timeSinceLastUpdate = (now - this.lastServerUpdate) / 1000;

		const predictedX = this.ball.x + this.ball.speedX * timeSinceLastUpdate;
		const predictedY = this.ball.y + this.ball.speedY * timeSinceLastUpdate;

		const targetPosition = new BABYLON.Vector3(
			(predictedX - (GameConfig.CANVAS_WIDTH / 2)) * this.scaleX,
			-0.2,
			((GameConfig.CANVAS_HEIGHT / 2) - predictedY) * this.scaleY
		);

		const directionChanged =
			Math.sign(this.ball.speedX) !== Math.sign(this.previousSpeedX) ||
			Math.sign(this.ball.speedY) !== Math.sign(this.previousSpeedY);

		this.previousSpeedX = this.ball.speedX;
		this.previousSpeedY = this.ball.speedY;

		const distance = BABYLON.Vector3.Distance(
			this.ballMesh.position,
			targetPosition
		);

		if (distance > 1 || directionChanged) {
			this.ballMesh.position = targetPosition;
		} else {
			const interpolationFactor = 0.3;
			this.ballMesh.position = BABYLON.Vector3.Lerp(
				this.ballMesh.position,
				targetPosition,
				interpolationFactor
			);
		}
		if (this.ball.speedX !== 0) {
			const rotationSpeed = 0.05;
			this.ballMesh.rotation.x +=
				rotationSpeed * Math.sign(this.ball.speedX);
			this.ballMesh.rotation.z +=
				rotationSpeed * Math.sign(this.ball.speedY);
		}
	}

	public handlePaddleHit(paddle: BABYLON.Mesh): void {
		if (!this.scene || GameConfig.TEST_MODE) return;
		const flash = new BABYLON.PointLight(
			"flash",
			paddle.position,
			this.scene
		);
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
	// 			(position.x - (GameConfig.CANVAS_WIDTH / 2)) * (20 / GameConfig.CANVAS_WIDTH),
	// 			0,
	// 			((GameConfig.CANVAS_HEIGHT / 2) - position.y) * (15 / GameConfig.CANVAS_HEIGHT)
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
	// 		(position.x - (GameConfig.CANVAS_WIDTH / 2)) * (20 / GameConfig.CANVAS_WIDTH),
	// 		0,
	// 		((GameConfig.CANVAS_HEIGHT / 2) - position.y) * (15 / GameConfig.CANVAS_HEIGHT)
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

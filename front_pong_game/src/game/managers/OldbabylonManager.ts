/// <reference path="../../types/babylon.d.ts" />
import { Ball } from "../classes/ball.js";
import { Paddle } from "../classes/paddle.js";
import { GameState } from "@shared/types/gameState";
import { GameConfig, PowerUpTypes, PowerUpType } from '../../../../shared/config/gameConfig.js';


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

	private gameStarted: boolean = false;
	private ballCentered: boolean = false;

	private lastRenderTime: number = 0;

	private powerupMeshes: Map<number, BABYLON.Mesh> = new Map();
	private activePowerups: Map<number, any> = new Map();

	//debug
	private paddleCollisionBox1: BABYLON.Mesh | null = null;
	private paddleCollisionBox2: BABYLON.Mesh | null = null;

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
		wallMaterial.alpha = 1;

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

		const tessellation = GameConfig.TEST_MODE ? 8 : 16;

		this.paddleMesh1 = BABYLON.MeshBuilder.CreateCylinder(
			"paddle1",
			{
				diameter: this.paddle1.width * this.scaleX,
				height: this.paddle1.height * this.scaleY,
				tessellation: tessellation,
			},
			this.scene
		);
		this.paddleMesh1.rotation.x = Math.PI / 2;
		this.paddleMesh1.material = paddleMaterial;
		this.paddleMesh1.position = new BABYLON.Vector3(
			(this.paddle1.x + this.paddle1.width / 2 - GameConfig.CANVAS_WIDTH / 2) * this.scaleX, // Center of paddle
			-0.25,
			(GameConfig.CANVAS_HEIGHT / 2 - this.paddle1.y) * this.scaleY
		);

		this.paddleMesh2 = BABYLON.MeshBuilder.CreateCylinder(
			"paddle2",
			{
				diameter: this.paddle2.width * this.scaleX,
				height: this.paddle2.height * this.scaleY,
				tessellation: tessellation,
			},
			this.scene
		);
		this.paddleMesh2.rotation.x = Math.PI / 2;
		this.paddleMesh2.material = paddleMaterial;
		this.paddleMesh2.position = new BABYLON.Vector3(
			(this.paddle2.x + this.paddle2.width / 2 - GameConfig.CANVAS_WIDTH / 2) * this.scaleX, // Center of paddle
			-0.25,
			(GameConfig.CANVAS_HEIGHT / 2 - this.paddle2.y) * this.scaleY
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
				diameter: this.ball.radius * 2 * this.scaleX,
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
			if (this.bottomWall)
				this.shadowGenerator.addShadowCaster(this.bottomWall);
			if (this.topWall)
				this.shadowGenerator.addShadowCaster(this.topWall);
		}

		if (!GameConfig.TEST_MODE) {
			const glowLayer = new BABYLON.GlowLayer("glow", this.scene);
			glowLayer.intensity = 0.7;
			glowLayer.addIncludedOnlyMesh(this.paddleMesh1);
			glowLayer.addIncludedOnlyMesh(this.paddleMesh2);
		}

		if (!GameConfig.TEST_MODE) {
			this.createCollisionBoxes();
		}
	}

	public testPowerups(): void {
		// Define test positions across the table
		const testPositions = [
			{ x: 200, y: 300 },  // Left side
			{ x: 400, y: 300 },  // Center-left
			{ x: 600, y: 300 },  // Center-right
			{ x: 800, y: 300 },  // Right
			{ x: 500, y: 500 }   // Center-bottom
		];

		// Create one of each powerup type
		const powerupTypes = [
			PowerUpTypes.PADDLE_GROW,
			PowerUpTypes.PADDLE_SHRINK,
			PowerUpTypes.BALL_GROW,
			PowerUpTypes.BALL_SHRINK,
			PowerUpTypes.PADDLE_SLOW
		];

		// Create each powerup at its test position
		powerupTypes.forEach((type, index) => {
			this.createPowerupMesh({
				id: index + 1,
				type: type,
				x: testPositions[index].x,
				y: testPositions[index].y
			});
		});
	}

	public createPowerupMesh(powerup: any): void {
		if (!this.scene) return;

		const position = new BABYLON.Vector3(
			(powerup.x - GameConfig.CANVAS_WIDTH / 2) * this.scaleX,
			-0.2,
			(GameConfig.CANVAS_HEIGHT / 2 - powerup.y / 2) * this.scaleY
		);

		let powerupPath = "";
		let emissiveColor = new BABYLON.Color3(1, 1, 1);

		switch (powerup.type) {
			case PowerUpTypes.PADDLE_GROW:
				powerupPath = "mushroom.glb";
				emissiveColor = new BABYLON.Color3(1, 0, 0); // Red
				break;
			case PowerUpTypes.PADDLE_SHRINK:
				powerupPath = "axe.glb";
				emissiveColor = new BABYLON.Color3(1, 1, 0); // Yellow
				break;
			case PowerUpTypes.BALL_GROW:
				powerupPath = "watermelon.glb";
				emissiveColor = new BABYLON.Color3(0, 0.5, 0); // Green
				break;
			case PowerUpTypes.BALL_SHRINK:
				powerupPath = "blueberry.glb";
				emissiveColor = new BABYLON.Color3(1, 0, 1); // Purple
				break;
			case PowerUpTypes.PADDLE_SLOW:
				powerupPath = "turtle.glb";
				emissiveColor = new BABYLON.Color3(0, 0, 1); // Blue
				break;
		}

		BABYLON.SceneLoader.ImportMesh("", "/assets/models/", powerupPath, this.scene, (meshes) => {
			if (meshes.length > 0 && this.scene) {
				const container = new BABYLON.Mesh(`powerup-${powerup.id}`, this.scene);
				container.position = position;


				switch (powerup.type) {
					case PowerUpTypes.PADDLE_SLOW: // Turtle
						const randomDirection = Math.random() < 0.5 ? 1 : -1;
						container.rotation.y = (Math.PI / 2) * randomDirection;
						break;
					case PowerUpTypes.PADDLE_SHRINK: // Axe
						container.rotation.x = Math.PI / 2;
						container.rotation.y = -Math.PI / 2;
						break;
					case PowerUpTypes.BALL_SHRINK: // Blueberry
						container.rotation.x = -Math.PI / 2;
						break;
					case PowerUpTypes.BALL_GROW: // Watermelon
						container.rotation.z = Math.PI / 2;
						break;
					case PowerUpTypes.PADDLE_GROW: // Mushroom
						container.position.y = 0.2;
						container.rotation.x = -Math.PI / 2;
						break;
				}

				for (const mesh of meshes) {
					if (mesh instanceof BABYLON.Mesh) {
						mesh.parent = container;
						if (powerup.type === PowerUpTypes.PADDLE_SLOW) {
							mesh.computeWorldMatrix(true);
							const boundingBox = mesh.getBoundingInfo();

							const height = boundingBox.boundingBox.maximumWorld.y - boundingBox.boundingBox.minimumWorld.y;
							const offset = height * 0.25 ; 
							mesh.position.y -= offset;
						}
						const scaleFactor = this.getScaleFactorForModel(powerup.type);
						mesh.scaling.scaleInPlace(scaleFactor * GameConfig.POWERUP_SIZE / 2);
					}
					// Apply emissive color to materials
					if (mesh.material) {
						if (mesh.material instanceof BABYLON.StandardMaterial) {
							mesh.material.emissiveColor = emissiveColor;
							mesh.material.specularPower = 64;
						} else if ((mesh.material as any) instanceof BABYLON.PBRMaterial) {
							const pbrMaterial = mesh.material as BABYLON.PBRMaterial;
							pbrMaterial.emissiveColor = emissiveColor;
							pbrMaterial.emissiveIntensity = 0.6;
						}
					}
				}
				if (!GameConfig.TEST_MODE) {
					const glowLayer = new BABYLON.GlowLayer(`powerup-glow-${powerup.id}`, this.scene);
					glowLayer.intensity = 0.7;
					glowLayer.addIncludedOnlyMesh(container);
					this.activePowerups.set(powerup.id, glowLayer);
				}
				this.powerupMeshes.set(powerup.id, container);

				const collisionSphere = BABYLON.MeshBuilder.CreateSphere(
					`powerup-collision-${powerup.id}`,
					{
						diameter: GameConfig.POWERUP_SIZE * this.scaleX,
						segments: 16
					},
					this.scene
				);
				const collisionMaterial = new BABYLON.StandardMaterial("collisionMaterial", this.scene);
				collisionMaterial.wireframe = true;
				collisionMaterial.alpha = 0.5;
				collisionMaterial.emissiveColor = emissiveColor;
				collisionSphere.material = collisionMaterial;
				collisionSphere.parent = container;

			}

		});
	}

	private getScaleFactorForModel(powerupType: PowerUpType): number {
		const scales = GameConfig.POWERUP_VISUAL_SCALES;
		return scales[powerupType] ?? 0.1;
	}

	public handlePowerupCollection(powerupId: number, playerNumber: number): void {
		const powerupMesh = this.powerupMeshes.get(powerupId);
		if (!powerupMesh || !this.scene) return;

		const particleSystem = new BABYLON.ParticleSystem(`powerup-collected-${powerupId}`, 200, this.scene);
		particleSystem.particleTexture = new BABYLON.Texture("/assets/textures/sparkle2.jpg", this.scene);
		particleSystem.emitter = powerupMesh.position;
		particleSystem.color1 = new BABYLON.Color4(1, 1, 1, 1);
		particleSystem.color2 = new BABYLON.Color4(0.8, 0.8, 0.8, 1);
		particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0);
		particleSystem.minSize = 0.1;
		particleSystem.maxSize = 0.5;
		particleSystem.minLifeTime = 0.5;
		particleSystem.maxLifeTime = 1;
		particleSystem.emitRate = 500;
		particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
		particleSystem.direction1 = new BABYLON.Vector3(-5, 5, -5);
		particleSystem.direction2 = new BABYLON.Vector3(5, 5, 5);
		particleSystem.minEmitPower = 1;
		particleSystem.maxEmitPower = 3;
		particleSystem.updateSpeed = 0.01;

		particleSystem.start();

		const targetPaddleMesh = playerNumber === 1 ? this.paddleMesh1 : this.paddleMesh2;
		if (targetPaddleMesh) {
			const paddleGlow = new BABYLON.GlowLayer(`paddle-powerup-glow-${playerNumber}`, this.scene)
			paddleGlow.intensity = 1.0;
			paddleGlow.addIncludedOnlyMesh(targetPaddleMesh);
			setTimeout(() => paddleGlow.dispose(), 1000);

			const glowLayer = this.activePowerups.get(powerupId);
			if (glowLayer) {
				glowLayer.dispose();
				this.activePowerups.delete(powerupId);
			}

			powerupMesh.dispose();
			this.powerupMeshes.delete(powerupId);

			setTimeout(() => {
				particleSystem.stop();
				setTimeout(() => particleSystem.dispose(), 1000);
			}, 500);
		}
	}

	public handlePowerupDeactivation(powerupId: number): void {
		const glowLayer = this.activePowerups.get(powerupId);
		if (glowLayer) {
			glowLayer.dispose();
			this.activePowerups.delete(powerupId);
		}

		const powerupMesh = this.powerupMeshes.get(powerupId);
		if (powerupMesh) {
			powerupMesh.dispose();
			this.powerupMeshes.delete(powerupId);
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
		this.gameStarted = gameState.gameStarted;
		if (this.gameStarted && this.ballCentered) {
			this.ballCentered = false;
		}
		if (this.paddleMesh1 && gameState.paddle1) {
			const newHeight = gameState.paddle1.height * this.scaleY;
			if (Math.abs(this.paddleMesh1.scaling.y - newHeight) > 0.001)
				this.updatePaddleMeshDimension(this.paddleMesh1, gameState.paddle1);
		}
		if (this.paddleMesh2 && gameState.paddle2) {
			const newHeight = gameState.paddle2.height * this.scaleY;
			if (Math.abs(this.paddleMesh2.scaling.y - newHeight) > 0.001)
				this.updatePaddleMeshDimension(this.paddleMesh2, gameState.paddle2);
		}
		if (this.ballMesh && gameState.ball) {
			const newDiameter = gameState.ball.radius * 2 * this.scaleX;
			if (Math.abs(this.ballMesh.scaling.x - newDiameter) > 0.001)
				this.updateBallMeshDimension(gameState.ball);
		}
	}

	private updatePaddleMeshDimension(paddleMesh: BABYLON.Mesh, paddleState: any): void {
		if (!this.scene) return;
		
		const originalHeight = paddleState.originalHeight ?? paddleState.height;
		const scaleFactor = paddleState.height / originalHeight;
		paddleMesh.scaling.y = scaleFactor;
		paddleMesh.position = new BABYLON.Vector3(
			(paddleState.x + paddleState.width / 2 - GameConfig.CANVAS_WIDTH / 2) * this.scaleX,
			-0.25,
			(GameConfig.CANVAS_HEIGHT / 2 - paddleState.y) * this.scaleY
		);
		this.updateCollisionBoxDimension(paddleMesh, paddleState);
	}

	private updateCollisionBoxDimension(paddleMesh: BABYLON.Mesh, paddleState: any): void {
		if (!this.paddleCollisionBox1 || !this.paddleCollisionBox2 || !this.paddleMesh1 || !this.paddleMesh2) return;

		const isPaddle1 = paddleMesh === this.paddleMesh1;
		const collisionBox = isPaddle1 ? this.paddleCollisionBox1 : this.paddleCollisionBox2;
		const originalHeight = paddleState.originalHeight || paddleState.height;
		const scaleFactor = paddleState.height / originalHeight;
		collisionBox.scaling.z = scaleFactor;
		collisionBox.position = new BABYLON.Vector3(
			(paddleState.x + paddleState.width / 2 - GameConfig.CANVAS_WIDTH / 2) * this.scaleX,
			-0.25,
			(GameConfig.CANVAS_HEIGHT / 2 - paddleState.y) * this.scaleY
		);
	}

	private updateBallMeshDimension(ballState: any): void {
		if (!this.scene || !this.ballMesh) return;
		const newScale = ballState.radius * this.scaleX / this.ballMesh.getBoundingInfo().boundingBox.extendSize.x;
		this.ballMesh.scaling = new BABYLON.Vector3(newScale, newScale, newScale);
	}

	private updateMeshPositions(): void {
		this.updatePaddleMeshPositions();
		if (!GameConfig.TEST_MODE) { // test
			this.updateCollisionBoxPositions();
		}
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
	}

	private updatePaddleMeshPositions(): void {
		if (!this.paddleMesh1 || !this.paddleMesh2) return;

		this.paddleMesh1.position = new BABYLON.Vector3(
			(this.paddle1.x + this.paddle1.width / 2 - GameConfig.CANVAS_WIDTH / 2) * this.scaleX,
			-0.25,
			(GameConfig.CANVAS_HEIGHT / 2 - this.paddle1.y) * this.scaleY
		);

		this.paddleMesh2.position = new BABYLON.Vector3(
			(this.paddle2.x + this.paddle2.width / 2 - GameConfig.CANVAS_WIDTH / 2) * this.scaleX,
			-0.25,
			(GameConfig.CANVAS_HEIGHT / 2 - this.paddle2.y) * this.scaleY
		);
	}

	private updateBallMeshPosition(): void {
		if (!this.ballMesh) return;

		const targetPosition = new BABYLON.Vector3(
			(this.ball.x - GameConfig.CANVAS_WIDTH / 2) * this.scaleX,
			-0.2,
			(GameConfig.CANVAS_HEIGHT / 2 - this.ball.y) * this.scaleY
		);

		this.ballMesh.position = targetPosition;
	}

	public handleBounce(position: { x: number, y: number }) {
		if (!this.scene) return;
		const bouncePosition = new BABYLON.Vector3(
			(position.x - (GameConfig.CANVAS_WIDTH / 2)) * (20 / GameConfig.CANVAS_WIDTH),
			-0.2,
			((GameConfig.CANVAS_HEIGHT / 2) - position.y) * (15 / GameConfig.CANVAS_HEIGHT)
		);
		this.addBounceEffect(bouncePosition);
	}

	private addBounceEffect(position: BABYLON.Vector3): void {
		if (!this.scene) return;

		const particleSystem = new BABYLON.ParticleSystem(
			"particles",
			300,
			this.scene
		);

		particleSystem.particleTexture = new BABYLON.Texture(
			"/assets/textures/sparkle.png",
			this.scene,
		);

		particleSystem.color1 = new BABYLON.Color4(1.0, 0.84, 0.0, 1.0);    // Bright gold
		particleSystem.color2 = new BABYLON.Color4(1.0, 0.6, 0.1, 1.0);    // Copper
		particleSystem.colorDead = new BABYLON.Color4(1, 1, 1, 0); // dark copper
		particleSystem.emitter = position;
		particleSystem.minSize = 0.1;
		particleSystem.maxSize = 0.6;
		particleSystem.minLifeTime = 0.3;
		particleSystem.maxLifeTime = 0.5;
		particleSystem.emitRate = 1000;
		particleSystem.gravity = new BABYLON.Vector3(0, -15, 0);
		particleSystem.direction1 = new BABYLON.Vector3(-3, -1, -3);
		particleSystem.direction2 = new BABYLON.Vector3(3, 3, 3);
		particleSystem.minAngularSpeed = -Math.PI * 2;
		particleSystem.maxAngularSpeed = Math.PI * 2;
		particleSystem.minEmitPower = 9;
		particleSystem.maxEmitPower = 13;
		particleSystem.minInitialRotation = 0;
		particleSystem.maxInitialRotation = Math.PI * 2;
		particleSystem.minEmitBox = new BABYLON.Vector3(-0.1, -0.1, -0.1);
		particleSystem.maxEmitBox = new BABYLON.Vector3(0.1, 0.1, 0.1);
		particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
		particleSystem.targetStopDuration = 0.3;

		particleSystem.start();

		setTimeout(() => {
			particleSystem.stop();
			setTimeout(() => particleSystem.dispose(), 800);
		}, 300);
	}

	public handlePaddleHit(playerNumber: number, ballPosition: { x: number, y: number }): void {
		if (!this.scene || GameConfig.TEST_MODE) return;
		const targetPaddleMesh = playerNumber === 1 ? this.paddleMesh1 : this.paddleMesh2;
		if (targetPaddleMesh) {
			const originalMaterial = targetPaddleMesh.material as BABYLON.StandardMaterial;
			const hitMaterial = originalMaterial.clone("hitMaterial");
			hitMaterial.emissiveColor = playerNumber === 1 ?
				new BABYLON.Color3(1, 0.3, 0.3) :
				new BABYLON.Color3(1, 0.3, 0.3);
			hitMaterial.specularPower = 128;
			targetPaddleMesh.material = hitMaterial;

			// 3. Add particles at the hit point
			this.handleBounce(ballPosition);

			// Reset everything after a short delay
			setTimeout(() => {
				targetPaddleMesh.material = originalMaterial;
			}, 200);
		}
	}

	public handleScoreEffect(scorer: number, position: { x: number; y: number }): void {
		if (!this.scene) return;
		const glowLayer = new BABYLON.GlowLayer("scoreGlow", this.scene);
		const scoreMesh = BABYLON.MeshBuilder.CreateSphere(
			"scoreEffect",
			{ diameter: 2 },
			this.scene
		);
		scoreMesh.position = new BABYLON.Vector3(
			(position.x - (GameConfig.CANVAS_WIDTH / 2)) * (20 / GameConfig.CANVAS_WIDTH),
			0,
			((GameConfig.CANVAS_HEIGHT / 2) - position.y) * (15 / GameConfig.CANVAS_HEIGHT)
		);

		const material = new BABYLON.StandardMaterial("scoreMaterial", this.scene);
		material.emissiveColor = scorer === 1 ?
			new BABYLON.Color3(1, 0, 0) :
			new BABYLON.Color3(0, 0, 1);
		scoreMesh.material = material;

		setTimeout(() => {
			glowLayer.dispose();
			scoreMesh.dispose();
		}, 1000);
	}


	private createCollisionBoxes(): void {
		if (!this.scene) return;

		// Create a semi-transparent material for collision boxes
		const collisionMaterial = new BABYLON.StandardMaterial(
			"collisionMaterial",
			this.scene
		);
		collisionMaterial.diffuseColor = new BABYLON.Color3(0, 1, 0);
		collisionMaterial.alpha = 0.3;
		collisionMaterial.wireframe = true;

		// Create collision box for paddle 1
		this.paddleCollisionBox1 = BABYLON.MeshBuilder.CreateBox(
			"paddle1Collision",
			{
				width: this.paddle1.width * this.scaleX,
				height: 0.5,
				depth: this.paddle1.height * this.scaleY,
			},
			this.scene
		);
		this.paddleCollisionBox1.material = collisionMaterial;
		const bottomEdge1 = -this.paddle1.height * this.scaleY / 2;
		this.paddleCollisionBox1.setPivotPoint(new BABYLON.Vector3(0, bottomEdge1, 0));

		// Create collision box for paddle 2
		this.paddleCollisionBox2 = BABYLON.MeshBuilder.CreateBox(
			"paddle2Collision",
			{
				width: this.paddle2.width * this.scaleX,
				height: 0.5,
				depth: this.paddle2.height * this.scaleY,
			},
			this.scene
		);
		this.paddleCollisionBox2.material = collisionMaterial;
		const bottomEdge2 = -this.paddle2.height * this.scaleY / 2;
		this.paddleCollisionBox2.setPivotPoint(new BABYLON.Vector3(0, bottomEdge2, 0));

		// Set initial positions
		this.updateCollisionBoxPositions();
	}

	private updateCollisionBoxPositions(): void {
		if (!this.paddleCollisionBox1 || !this.paddleCollisionBox2) return;

		// Position collision box for paddle 1
		this.paddleCollisionBox1.position = new BABYLON.Vector3(
			(this.paddle1.x + this.paddle1.width / 2 - GameConfig.CANVAS_WIDTH / 2) * this.scaleX,
			-0.25,
			(GameConfig.CANVAS_HEIGHT / 2 - this.paddle1.y ) * this.scaleY
		);

		// Position collision box for paddle 2
		this.paddleCollisionBox2.position = new BABYLON.Vector3(
			(this.paddle2.x + this.paddle2.width / 2 - GameConfig.CANVAS_WIDTH / 2) * this.scaleX,
			-0.25,
			(GameConfig.CANVAS_HEIGHT / 2 - this.paddle2.y ) * this.scaleY
		);
	}

	dispose(): void {
		this.hideLoadingScreen();
		// Remove event listener using the bound method
		window.removeEventListener("resize", this.handleResize);

		if (this.engine && !this.engine.isDisposed) {
			this.engine.dispose();
		}

		// Dispose of all meshes
		if (this.paddleMesh1) {
			this.paddleMesh1.dispose();
		}
		if (this.paddleMesh2) {
			this.paddleMesh2.dispose();
		}
		if (this.ballMesh) {
			this.ballMesh.dispose();
		}
		if (this.tableMesh) {
			this.tableMesh.dispose();
		}
		if (this.topWall) {
			this.topWall.dispose();
		}
		if (this.bottomWall) {
			this.bottomWall.dispose();
		}
		if (this.paddleCollisionBox1) {
			this.paddleCollisionBox1.dispose();
		}
		if (this.paddleCollisionBox2) {
			this.paddleCollisionBox2.dispose();
		}
		this.powerupMeshes.forEach((mesh) => mesh.dispose());
		this.powerupMeshes.clear();


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
		this.topWall = null;
		this.bottomWall = null;
		this.loadingScreen = null;
		this.paddleCollisionBox1 = null;
		this.paddleCollisionBox2 = null;
	}
}

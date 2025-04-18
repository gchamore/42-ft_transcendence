/// <reference path="../../types/babylon.d.ts" />
import { Ball } from "../classes/ball.js";
import { Paddle } from "../classes/paddle.js";
import { GameState } from "@shared/types/gameState";
import { GameConfig } from '../../../../shared/config/gameConfig.js';

// Import all managers
import { EngineManager } from "./babylon/core/engineManager.js";
import { SceneManager } from "./babylon/core/sceneManager.js";
import { CameraManager } from "./babylon/core/cameraManager.js";
import { LightManager } from "./babylon/core/lightManager.js";
import { EnvironmentFactory } from "./babylon/environment/environmentFactory.js";
import { PaddleManager } from "./babylon/entities/paddleManager.js";
import { BallManager } from "./babylon/entities/ballManager.js";
import { CollisionManager } from "./babylon/entities/collisionManager.js";
import { PowerUpManager } from "./babylon/powerups/powerUpManager.js";
import { EffectsManager } from "./babylon/effects/effectsManager.js";
import { LoadingScreen } from "./babylon/ui/loadingScreen.js";
import { CoordinateConverter } from "./babylon/utils/coordinatesConverter.js";

export class BabylonManager {
	// Core components
	private engineManager: EngineManager;
	private sceneManager: SceneManager;
	private cameraManager: CameraManager;
	private lightManager: LightManager;

	// Game environment and entities
	private environmentFactory: EnvironmentFactory;
	private paddleManager: PaddleManager;
	private ballManager: BallManager;
	private collisionManager: CollisionManager;

	// Effects and UI
	private powerUpManager!: PowerUpManager;
	private effectsManager: EffectsManager;
	private loadingScreen: LoadingScreen;

	// Utilities
	private coordinateConverter: CoordinateConverter;

	// Game state
	private gameStarted: boolean = false;
	private lastRenderTime: number = 0;
	private readonly frameInterval: number = 1000 / GameConfig.TARGET_FPS;

	constructor(
		canvas: HTMLCanvasElement,
		private paddle1: Paddle,
		private paddle2: Paddle,
		private ball: Ball,
		private mapType: string,
		private powerUpsEnabled: boolean,
		private onLoadingComplete?: () => void
	) {
		// Initialize loading screen first
		this.loadingScreen = new LoadingScreen();
		this.loadingScreen.show();

		// Initialize core systems
		this.engineManager = new EngineManager(canvas);
		this.sceneManager = new SceneManager(this.engineManager.getEngine());
		this.cameraManager = new CameraManager(this.sceneManager.getScene());
		this.lightManager = new LightManager(this.sceneManager.getScene());

		// Initialize utilities
		this.coordinateConverter = new CoordinateConverter();

		// Initialize game environment and entities
		this.environmentFactory = new EnvironmentFactory(
			this.sceneManager.getScene()
		);

		this.paddleManager = new PaddleManager(
			this.sceneManager.getScene(),
			this.lightManager.getShadowGenerator(),
			this.paddle1,
			this.paddle2,
			this.coordinateConverter
		);

		this.ballManager = new BallManager(
			this.sceneManager.getScene(),
			this.lightManager.getShadowGenerator(),
			this.ball,
			this.coordinateConverter
		);

		this.collisionManager = new CollisionManager(
			this.sceneManager.getScene(),
			this.paddleManager,
			GameConfig.TEST_MODE
		);

		// Initialize effects and powerups
		this.effectsManager = new EffectsManager(this.sceneManager.getScene());

		if (this.powerUpsEnabled) {
			this.powerUpManager = new PowerUpManager(
				this.sceneManager.getScene(),
				this.paddleManager,
				this.coordinateConverter,
				this.effectsManager
			);
		}

		// Set up the environment
		this.setupEnvironment();

		// Start rendering
		this.lastRenderTime = performance.now();
		this.render(this.lastRenderTime);

		// Complete loading
		setTimeout(() => {
			this.loadingScreen.hide();
			if (this.onLoadingComplete) {
				this.onLoadingComplete();
			}
		}, 1000);

		// Set up event handlers
		this.setupEventHandlers();
	}

	private setupEnvironment(): void {
		this.environmentFactory.createTable();
		this.environmentFactory.createWalls();
		this.environmentFactory.createCenterLine();
		if (this.mapType === "custom") {
			this.environmentFactory.createCustomMap();
		}
	}

	private setupEventHandlers(): void {
		window.addEventListener("resize", this.handleResize.bind(this));
	}

	private handleResize(): void {
		this.engineManager.resize();
	}

	public render(timestamp: number): void {
		const elapsed = timestamp - this.lastRenderTime;
		if (elapsed > this.frameInterval) {
			this.lastRenderTime = timestamp - (elapsed % this.frameInterval);

			// Update positions
			this.paddleManager.updatePositions();

			if (this.gameStarted) {
				this.ballManager.updatePosition();
			} else if (!this.ballManager.isCentered()) {
				this.ballManager.centerBall();
			}

			if (!GameConfig.TEST_MODE) {
				this.collisionManager.updatePositions();
			}

			// Render the scene
			this.sceneManager.render();
		}

		// Request next frame
		requestAnimationFrame(this.render.bind(this));
	}

	public renderLocalPaddle(): void {
		this.paddleManager.updatePositions();
		if (!this.gameStarted) {
			this.sceneManager.render();
		}
	}

	public updateGameState(gameState: GameState): void {
		this.gameStarted = gameState.gameStarted;

		// Update paddle dimensions if needed
		if (gameState.paddle1) {
			this.paddleManager.updatePaddle1Dimensions(gameState.paddle1);
		}

		if (gameState.paddle2) {
			this.paddleManager.updatePaddle2Dimensions(gameState.paddle2);
		}

		// Update ball dimensions if needed
		if (gameState.ball) {
			this.ballManager.updateDimensions(gameState.ball);
		}
	}

	public testPowerups(): void {
		this.powerUpManager.createTestPowerups();
	}

	public handleBounce(position: { x: number, y: number }): void {
		this.effectsManager.createBounceEffect(
			this.coordinateConverter.toScenePosition(position.x, position.y)
		);
	}

	public handlePaddleHit(playerNumber: number, ballPosition: { x: number, y: number }): void {
		if (GameConfig.TEST_MODE) return;

		const paddleMesh = playerNumber === 1
			? this.paddleManager.getPaddle1Mesh()
			: this.paddleManager.getPaddle2Mesh();

		this.effectsManager.createPaddleHitEffect(paddleMesh, playerNumber);
		this.handleBounce(ballPosition);
	}

	public handleScoreEffect(scorer: number, position: { x: number, y: number }): void {
		this.effectsManager.createScoreEffect(
			scorer,
			this.coordinateConverter.toScenePosition(position.x, position.y, 0)
		);
	}

	public createPowerupMesh(powerup: any): void {
		this.powerUpManager.createPowerup(powerup);
	}

	public handlePowerupCollection(powerupId: number, playerNumber: number): void {
		this.powerUpManager.collectPowerup(powerupId, playerNumber);
	}

	public handlePowerupDeactivation(powerupId: number): void {
		this.powerUpManager.deactivatePowerup(powerupId);
	}

	public getEngine(): BABYLON.Engine | null {
		return this.engineManager.getEngine();
	}

	public dispose(): void {
		// Remove event listeners
		window.removeEventListener("resize", this.handleResize);

		// Dispose all managers
		this.loadingScreen.hide();
		if (this.powerUpsEnabled) {
			this.powerUpManager.dispose();
		}
		this.effectsManager.dispose();
		this.collisionManager.dispose();
		this.ballManager.dispose();
		this.paddleManager.dispose();
		this.environmentFactory.dispose();
		this.lightManager.dispose();
		this.cameraManager.dispose();
		this.sceneManager.dispose();
		this.engineManager.dispose();
	}
}
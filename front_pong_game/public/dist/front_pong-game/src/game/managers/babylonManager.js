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
    constructor(canvas, paddle1, paddle2, ball, onLoadingComplete) {
        this.paddle1 = paddle1;
        this.paddle2 = paddle2;
        this.ball = ball;
        this.onLoadingComplete = onLoadingComplete;
        // Game state
        this.gameStarted = false;
        this.lastRenderTime = 0;
        this.frameInterval = 1000 / GameConfig.TARGET_FPS;
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
        this.environmentFactory = new EnvironmentFactory(this.sceneManager.getScene());
        this.paddleManager = new PaddleManager(this.sceneManager.getScene(), this.lightManager.getShadowGenerator(), this.paddle1, this.paddle2, this.coordinateConverter);
        this.ballManager = new BallManager(this.sceneManager.getScene(), this.lightManager.getShadowGenerator(), this.ball, this.coordinateConverter);
        this.collisionManager = new CollisionManager(this.sceneManager.getScene(), this.paddleManager, GameConfig.TEST_MODE);
        // Initialize effects and powerups
        this.effectsManager = new EffectsManager(this.sceneManager.getScene());
        this.powerUpManager = new PowerUpManager(this.sceneManager.getScene(), this.paddleManager, this.coordinateConverter, this.effectsManager);
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
    setupEnvironment() {
        this.environmentFactory.createTable();
        this.environmentFactory.createWalls();
        this.environmentFactory.createCenterLine();
    }
    setupEventHandlers() {
        window.addEventListener("resize", this.handleResize.bind(this));
    }
    handleResize() {
        this.engineManager.resize();
    }
    render(timestamp) {
        const elapsed = timestamp - this.lastRenderTime;
        if (elapsed > this.frameInterval) {
            this.lastRenderTime = timestamp - (elapsed % this.frameInterval);
            // Update positions
            this.paddleManager.updatePositions();
            if (this.gameStarted) {
                this.ballManager.updatePosition();
            }
            else if (!this.ballManager.isCentered()) {
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
    renderLocalPaddle() {
        this.paddleManager.updatePositions();
        if (!this.gameStarted) {
            this.sceneManager.render();
        }
    }
    updateGameState(gameState) {
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
    testPowerups() {
        this.powerUpManager.createTestPowerups();
    }
    handleBounce(position) {
        this.effectsManager.createBounceEffect(this.coordinateConverter.toScenePosition(position.x, position.y));
    }
    handlePaddleHit(playerNumber, ballPosition) {
        if (GameConfig.TEST_MODE)
            return;
        const paddleMesh = playerNumber === 1
            ? this.paddleManager.getPaddle1Mesh()
            : this.paddleManager.getPaddle2Mesh();
        this.effectsManager.createPaddleHitEffect(paddleMesh, playerNumber);
        this.handleBounce(ballPosition);
    }
    handleScoreEffect(scorer, position) {
        this.effectsManager.createScoreEffect(scorer, this.coordinateConverter.toScenePosition(position.x, position.y, 0));
    }
    createPowerupMesh(powerup) {
        this.powerUpManager.createPowerup(powerup);
    }
    handlePowerupCollection(powerupId, playerNumber) {
        this.powerUpManager.collectPowerup(powerupId, playerNumber);
    }
    handlePowerupDeactivation(powerupId) {
        this.powerUpManager.deactivatePowerup(powerupId);
    }
    getEngine() {
        return this.engineManager.getEngine();
    }
    dispose() {
        // Remove event listeners
        window.removeEventListener("resize", this.handleResize);
        // Dispose all managers
        this.loadingScreen.hide();
        this.powerUpManager.dispose();
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

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { GameConfig, PowerUpTypes } from '../../../../../../shared/config/gameConfig.js';
import { PowerUpFactory } from './powerUpFactory.js';
export class PowerUpManager {
    constructor(scene, paddleManager, coordinateConverter, effectsManager) {
        this.scene = scene;
        this.paddleManager = paddleManager;
        this.powerupMeshes = new Map();
        this.activePowerups = new Map();
        this.powerUpFactory = new PowerUpFactory(scene, coordinateConverter, effectsManager);
    }
    createPowerup(powerup) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.scene || !powerup || !powerup.id)
                return;
            try {
                const mesh = yield this.powerUpFactory.createPowerupMesh(powerup);
                if (mesh) {
                    this.powerupMeshes.set(powerup.id, mesh);
                }
            }
            catch (error) {
                console.error(`Error creating powerup ${powerup.id}:`, error);
            }
        });
    }
    createTestPowerups() {
        return __awaiter(this, void 0, void 0, function* () {
            const powerupTypes = [
                PowerUpTypes.PADDLE_GROW,
                PowerUpTypes.PADDLE_SHRINK,
                PowerUpTypes.BALL_GROW,
                PowerUpTypes.BALL_SHRINK,
                PowerUpTypes.PADDLE_SLOW,
            ];
            for (let i = 0; i < powerupTypes.length; i++) {
                const powerup = {
                    id: i + 1,
                    type: powerupTypes[i],
                    x: 200 + i * 100,
                    y: GameConfig.CANVAS_HEIGHT / 2
                };
                yield this.createPowerup(powerup);
            }
        });
    }
    collectPowerup(powerupId, playerNumber) {
        const powerupMesh = this.powerupMeshes.get(powerupId);
        if (!powerupMesh || !this.scene)
            return;
        // Get the paddle that collected the powerup
        const paddleMesh = playerNumber === 1
            ? this.paddleManager.getPaddle1Mesh()
            : this.paddleManager.getPaddle2Mesh();
        if (paddleMesh) {
            // Create collection effect
            const particleSystem = new BABYLON.ParticleSystem(`powerup-collect-${powerupId}`, 100, this.scene);
            particleSystem.particleTexture = new BABYLON.Texture("/assets/textures/flare.png", this.scene);
            particleSystem.emitter = powerupMesh.position;
            particleSystem.color1 = new BABYLON.Color4(1, 1, 1, 1); // White color
            particleSystem.color2 = new BABYLON.Color4(1, 0.84, 0.4, 0.8); // Light orange color
            particleSystem.colorDead = new BABYLON.Color4(0.53, 0.81, 0.98, 0); // Blue color
            particleSystem.minSize = 0.1;
            particleSystem.maxSize = 0.3;
            particleSystem.minLifeTime = 0.2;
            particleSystem.maxLifeTime = 0.4;
            particleSystem.emitRate = 200;
            particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
            particleSystem.direction1 = new BABYLON.Vector3(-1, 1, -1);
            particleSystem.direction2 = new BABYLON.Vector3(1, 1, 1);
            particleSystem.minEmitPower = 1;
            particleSystem.maxEmitPower = 3;
            particleSystem.updateSpeed = 0.01;
            particleSystem.start();
            // Dispose the powerup mesh
            powerupMesh.dispose();
            this.powerupMeshes.delete(powerupId);
            // Auto-dispose the particle system after a short time
            setTimeout(() => {
                particleSystem.stop();
                particleSystem.dispose();
                this.activePowerups.delete(powerupId);
            }, 800);
        }
    }
    deactivatePowerup(powerupId) {
        const powerupMesh = this.powerupMeshes.get(powerupId);
        if (!powerupMesh)
            return;
        if (powerupMesh) {
            powerupMesh.dispose();
            this.powerupMeshes.delete(powerupId);
        }
        const activePowerup = this.activePowerups.get(powerupId);
        if (activePowerup && activePowerup.particleSystem) {
            activePowerup.particleSystem.stop();
            activePowerup.particleSystem.dispose();
        }
        this.activePowerups.delete(powerupId);
    }
    dispose() {
        // Clean up powerup meshes
        this.powerupMeshes.forEach(mesh => {
            if (mesh) {
                mesh.dispose();
            }
        });
        this.powerupMeshes.clear();
        // Clean up active powerups
        this.activePowerups.forEach(powerup => {
            if (powerup.particleSystem) {
                powerup.particleSystem.dispose();
            }
        });
        this.activePowerups.clear();
    }
}

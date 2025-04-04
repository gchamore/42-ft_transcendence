import { GameConfig, PowerUpTypes } from '../../../../../../shared/config/gameConfig.js';
import { CoordinateConverter } from '../utils/coordinatesConverter.js';
import { PaddleManager } from '../entities/paddleManager.js';
import { EffectsManager } from '../effects/effectsManager.js';
import { PowerUpFactory } from './powerUpFactory.js';

export class PowerUpManager {
	private powerupMeshes: Map<number, BABYLON.Mesh> = new Map();
	private activePowerups: Map<number, any> = new Map();
	private powerUpFactory: PowerUpFactory;

	constructor(
		private scene: BABYLON.Scene | null,
		private paddleManager: PaddleManager,
		coordinateConverter: CoordinateConverter,
		effectsManager: EffectsManager
	) {
		this.powerUpFactory = new PowerUpFactory(scene, coordinateConverter, effectsManager);
	}

	public async createPowerup(powerup: any): Promise<void> {
		if (!this.scene || !powerup || !powerup.id) return;

		try {
			const mesh = await this.powerUpFactory.createPowerupMesh(powerup);
			if (mesh) {
				this.powerupMeshes.set(powerup.id, mesh);
			}
		} catch (error) {
			console.error(`Error creating powerup ${powerup.id}:`, error);
		}
	}

	public async createTestPowerups(): Promise<void> {
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

			await this.createPowerup(powerup);
		}
	}

	public collectPowerup(powerupId: number, playerNumber: number): void {
		const powerupMesh = this.powerupMeshes.get(powerupId);
		if (!powerupMesh || !this.scene) return;

		// Get the paddle that collected the powerup
		const paddleMesh = playerNumber === 1
			? this.paddleManager.getPaddle1Mesh()
			: this.paddleManager.getPaddle2Mesh();

		if (paddleMesh) {
			// Create collection effect
			const particleSystem = new BABYLON.ParticleSystem(`powerup-collect-${powerupId}`, 100, this.scene);
			particleSystem.particleTexture = new BABYLON.Texture("/assets/textures/flare.png", this.scene);
			particleSystem.emitter = powerupMesh.position.clone();
			particleSystem.color1 = new BABYLON.Color4(1, 1, 1, 1);

			if (powerupMesh.material && powerupMesh.material instanceof BABYLON.StandardMaterial) {
				const color = powerupMesh.material.diffuseColor;
				particleSystem.color2 = new BABYLON.Color4(color.r, color.g, color.b, 1);
			}

			particleSystem.colorDead = new BABYLON.Color4(0.7, 0.7, 0.7, 0);
			particleSystem.minSize = 0.1;
			particleSystem.maxSize = 0.5;
			particleSystem.minLifeTime = 0.3;
			particleSystem.maxLifeTime = 1;
			particleSystem.emitRate = 100;
			particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
			particleSystem.direction1 = new BABYLON.Vector3(-2, 2, -2);
			particleSystem.direction2 = new BABYLON.Vector3(2, 2, 2);
			particleSystem.minEmitPower = 1;
			particleSystem.maxEmitPower = 3;

			particleSystem.start();

			// Dispose the powerup mesh
			powerupMesh.dispose();
			this.powerupMeshes.delete(powerupId);

			// Store the particle system for disposal later
			this.activePowerups.set(powerupId, {
				particleSystem,
				playerNumber
			});

			// Auto-dispose the particle system after a short time
			setTimeout(() => {
				particleSystem.stop();
			}, 1000);
		}
	}

	public deactivatePowerup(powerupId: number): void {
		const activePowerup = this.activePowerups.get(powerupId);
		if (!activePowerup) return;

		if (activePowerup.particleSystem) {
			activePowerup.particleSystem.dispose();
		}

		this.activePowerups.delete(powerupId);
	}

	public dispose(): void {
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
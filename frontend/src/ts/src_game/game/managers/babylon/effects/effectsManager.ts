import { GameConfig } from "../../../../../shared/config/gameConfig.js";

export class EffectsManager {
	private activeParticleSystems: BABYLON.ParticleSystem[] = [];

	constructor(private scene: BABYLON.Scene | null) { }

	public createBounceEffect(position: BABYLON.Vector3): void {
		if (!this.scene || GameConfig.TEST_MODE) return;

		const particleSystem = new BABYLON.ParticleSystem("bounce-effect", 100, this.scene);
		particleSystem.particleTexture = new BABYLON.Texture("/assets/textures/sparkle.png", this.scene);
		particleSystem.emitter = position;
		particleSystem.color1 = new BABYLON.Color4(0.7, 0.8, 1.0, 1.0);
		particleSystem.color2 = new BABYLON.Color4(0.2, 0.5, 1.0, 1.0);
		particleSystem.colorDead = new BABYLON.Color4(0, 0, 0.2, 0.0);
		particleSystem.minSize = 0.1;
		particleSystem.maxSize = 0.3;
		particleSystem.minLifeTime = 0.2;
		particleSystem.maxLifeTime = 0.4;
		particleSystem.emitRate = 300;
		particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
		particleSystem.direction1 = new BABYLON.Vector3(-1, 1, -1);
		particleSystem.direction2 = new BABYLON.Vector3(1, 1, 1);
		particleSystem.minEmitPower = 1;
		particleSystem.maxEmitPower = 2;
		particleSystem.updateSpeed = 0.01;

		particleSystem.start();
		this.activeParticleSystems.push(particleSystem);

		// Auto-dispose after effect completes
		setTimeout(() => {
			if (particleSystem) {
				particleSystem.stop();
				const index = this.activeParticleSystems.indexOf(particleSystem);
				if (index !== -1) {
					this.activeParticleSystems.splice(index, 1);
				}
				particleSystem.dispose();
			}
		}, 800);
	}

	public createPaddleHitEffect(paddleMesh: BABYLON.Mesh | null, playerNumber: number): void {
		if (!this.scene || !paddleMesh || GameConfig.TEST_MODE) return;

		// Create a flash effect on the paddle
		const originalEmissive = (paddleMesh.material as BABYLON.StandardMaterial).emissiveColor?.clone();

		// Set paddle to glow brightly
		const hitColor = playerNumber === 1
			? new BABYLON.Color3(0.8, 0.2, 1)
			: new BABYLON.Color3(0.2, 0.8, 1);

		(paddleMesh.material as BABYLON.StandardMaterial).emissiveColor = hitColor;

		// Revert back after a short time
		setTimeout(() => {
			if (paddleMesh && paddleMesh.material) {
				(paddleMesh.material as BABYLON.StandardMaterial).emissiveColor = originalEmissive || new BABYLON.Color3(0.5, 0, 1);
			}
		}, 300);

		// Also create a particle effect
		const particleSystem = new BABYLON.ParticleSystem("paddle-hit", 50, this.scene);
		particleSystem.particleTexture = new BABYLON.Texture("/assets/textures/sparkle2.jpg", this.scene);
		particleSystem.emitter = paddleMesh.position;
		particleSystem.color1 = new BABYLON.Color4(1, 1, 1, 1);
		particleSystem.color2 = playerNumber === 1
			? new BABYLON.Color4(0.8, 0.2, 1, 1)
			: new BABYLON.Color4(0.2, 0.8, 1, 1);
		particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0);
		particleSystem.minSize = 0.1;
		particleSystem.maxSize = 0.3;
		particleSystem.minLifeTime = 0.3;
		particleSystem.maxLifeTime = 0.6;
		particleSystem.emitRate = 100;
		particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
		particleSystem.minEmitPower = 0.5;
		particleSystem.maxEmitPower = 1.5;

		particleSystem.start();
		this.activeParticleSystems.push(particleSystem);

		// Auto-dispose after effect completes
		setTimeout(() => {
			if (particleSystem) {
				particleSystem.stop();
				const index = this.activeParticleSystems.indexOf(particleSystem);
				if (index !== -1) {
					this.activeParticleSystems.splice(index, 1);
				}
				particleSystem.dispose();
			}
		}, 1000);
	}

	public createScoreEffect(scorer: number, position: BABYLON.Vector3): void {
		if (!this.scene || GameConfig.TEST_MODE) return;

		const particleSystem = new BABYLON.ParticleSystem("score-effect", 500, this.scene);
		particleSystem.particleTexture = new BABYLON.Texture("/assets/textures/firework.jpg", this.scene);
		particleSystem.emitter = position;

		// Color based on who scored
		const color = scorer === 1
			? new BABYLON.Color4(1, 0.4, 0.1, 1)   // Orange for player 1
			: new BABYLON.Color4(0.1, 0.5, 1, 1);  // Blue for player 2

		particleSystem.color1 = color;
		particleSystem.color2 = new BABYLON.Color4(1, 1, 1, 1);
		particleSystem.colorDead = new BABYLON.Color4(0.1, 0.1, 0.1, 0);
		particleSystem.minSize = 0.2;
		particleSystem.maxSize = 0.6;
		particleSystem.minLifeTime = 0.5;
		particleSystem.maxLifeTime = 1.5;
		particleSystem.emitRate = 500;
		particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
		particleSystem.direction1 = new BABYLON.Vector3(-5, 5, -5);
		particleSystem.direction2 = new BABYLON.Vector3(5, 5, 5);
		particleSystem.minEmitPower = 3;
		particleSystem.maxEmitPower = 7;
		particleSystem.updateSpeed = 0.01;
		particleSystem.gravity = new BABYLON.Vector3(0, -1, 0);

		particleSystem.start();
		this.activeParticleSystems.push(particleSystem);

		// Auto-dispose after effect completes
		setTimeout(() => {
			if (particleSystem) {
				particleSystem.stop();
				const index = this.activeParticleSystems.indexOf(particleSystem);
				if (index !== -1) {
					this.activeParticleSystems.splice(index, 1);
				}
				particleSystem.dispose();
			}
		}, 2000);
	}

	public createPowerupEffect(mesh: BABYLON.Mesh): BABYLON.GlowLayer {
		if (!this.scene || !mesh) {
			throw new Error("Scene or mesh not available");
		}

		const glowLayer = new BABYLON.GlowLayer(`powerup-glow-${Date.now()}`, this.scene);
		glowLayer.intensity = 0.8;
		glowLayer.addIncludedOnlyMesh(mesh);

		return glowLayer;
	}

	public dispose(): void {
		// Stop and dispose all active particle systems
		this.activeParticleSystems.forEach(particleSystem => {
			particleSystem.stop();
			particleSystem.dispose();
		});

		this.activeParticleSystems = [];
	}
}
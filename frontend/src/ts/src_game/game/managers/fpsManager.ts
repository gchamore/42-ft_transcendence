export class FPSManager {
	private frameCount: number = 0;
	private lastFpsUpdate: number = performance.now();
	private fpsUpdateInterval: number = 500; // Update every 500ms
	private fpsCounterElement: HTMLElement | null;
	private currentFps: number = 0;

	constructor() {
		this.fpsCounterElement = document.getElementById('fps-counter');
		if (!this.fpsCounterElement) {
			this.createFpsCounter();
		}
	}

	//Create the FPS counter element if not present in the DOM
	private createFpsCounter(): void {
		this.fpsCounterElement = document.createElement('div');
		this.fpsCounterElement.id = 'fps-counter';
		this.fpsCounterElement.style.position = 'fixed';
		this.fpsCounterElement.style.top = '10px';
		this.fpsCounterElement.style.right = '10px';
		this.fpsCounterElement.style.color = 'white';
		this.fpsCounterElement.style.background = 'rgba(0,0,0,0.5)';
		this.fpsCounterElement.style.padding = '5px';
		this.fpsCounterElement.style.zIndex = '1000';
		this.fpsCounterElement.style.fontFamily = 'monospace';
		this.fpsCounterElement.style.fontSize = '14px';
		this.fpsCounterElement.style.borderRadius = '3px';
		this.fpsCounterElement.textContent = 'FPS: --';
		document.body.appendChild(this.fpsCounterElement);
	}

	// Toggle visibility of the FPS counter
	toggleVisibility(visible?: boolean): void {
		if (!this.fpsCounterElement) return;

		if (visible === undefined) {
			const isVisible = this.fpsCounterElement.style.display !== 'none';
			this.fpsCounterElement.style.display = isVisible ? 'none' : 'block';
		} else {
			this.fpsCounterElement.style.display = visible ? 'block' : 'none';
		}
	}

	update(timestamp: number): void {
		this.frameCount++;
		const elapsed = timestamp - this.lastFpsUpdate;

		if (elapsed >= this.fpsUpdateInterval) {
			// Always use real frame timing for FPS calculation
			this.currentFps = Math.round(this.frameCount / (elapsed / 1000));
			this.updateFpsDisplay(this.currentFps);

			this.lastFpsUpdate = timestamp;
			this.frameCount = 0;
		}
	}

	updateFpsDisplay(fps: number): void {
		if (!this.fpsCounterElement) return;

		this.fpsCounterElement.textContent = `FPS: ${fps}`;

		if (fps >= 50) {
			this.fpsCounterElement.style.color = '#4CAF50'; // Green for good
		} else if (fps >= 30) {
			this.fpsCounterElement.style.color = '#FFEB3B'; // Yellow for ok
		} else {
			this.fpsCounterElement.style.color = '#F44336'; // Red for poor
		}
	}

	dispose(): void {
		if (this.fpsCounterElement && this.fpsCounterElement.parentNode) {
			this.fpsCounterElement.parentNode.removeChild(this.fpsCounterElement);
		}
		this.fpsCounterElement = null;
	}
}

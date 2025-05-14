export class LoadingScreen {
	private element: HTMLElement | null = null;

	constructor() {
		this.element = document.getElementById("babylon-loading-screen");
	}

	public show(): void {
		if (this.element) {
			this.element.style.opacity = "1";
			this.element.style.display = "flex";
		}
	}

	public hide(): void {
		if (this.element) {
			this.element.style.opacity = "0";
			setTimeout(() => {
				if (this.element) {
					this.element.style.display = "none";
				}
			}, 500);
		}
	}
}

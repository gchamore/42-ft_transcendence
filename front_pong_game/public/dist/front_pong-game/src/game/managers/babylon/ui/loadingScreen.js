export class LoadingScreen {
    constructor() {
        this.element = null;
        this.createLoadingScreen();
    }
    createLoadingScreen() {
        this.element = document.createElement("div");
        this.element.id = "babylon-loading-screen";
        const titleElement = document.createElement("div");
        titleElement.id = "loading-title";
        titleElement.textContent = "Loading 3D Scene...";
        const spinnerElement = document.createElement("div");
        spinnerElement.id = "loading-spinner";
        this.element.appendChild(titleElement);
        this.element.appendChild(spinnerElement);
        // Don't add to DOM yet - will be added on show()
    }
    show() {
        if (!this.element) {
            this.createLoadingScreen();
        }
        if (this.element) {
            // Reset opacity
            this.element.style.opacity = "1";
            const gameContainer = document.getElementById("game-container");
            if (gameContainer) {
                gameContainer.appendChild(this.element);
            }
            else {
                document.body.appendChild(this.element);
            }
        }
    }
    hide() {
        if (this.element) {
            // Fade out the loading screen
            this.element.style.opacity = "0";
            // Remove after transition completes
            setTimeout(() => {
                if (this.element && this.element.parentNode) {
                    this.element.parentNode.removeChild(this.element);
                }
            }, 500);
        }
    }
}

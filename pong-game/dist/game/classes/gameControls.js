export class PlayerControls {
    constructor() {
        this.up = false;
        this.down = false;
    }
}
export class GameControls {
    constructor() {
        this.player1 = new PlayerControls();
        this.player2 = new PlayerControls();
    }
    resetControls() {
        this.player1.up = false;
        this.player1.down = false;
        this.player2.up = false;
        this.player2.down = false;
    }
    handleKeyDown(event) {
        switch (event.key) {
            case 'w':
                this.player1.up = true;
                break;
            case 's':
                this.player1.down = true;
                break;
            case 'ArrowUp':
                this.player2.up = true;
                break;
            case 'ArrowDown':
                this.player2.down = true;
                break;
        }
    }
    handleKeyUp(event) {
        switch (event.key) {
            case 'w':
                this.player1.up = false;
                break;
            case 's':
                this.player1.down = false;
                break;
            case 'ArrowUp':
                this.player2.up = false;
                break;
            case 'ArrowDown':
                this.player2.down = false;
                break;
        }
    }
}

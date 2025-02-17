export class PlayerControls {
    constructor() {
        this.up = false;
        this.down = false;
        this.up = false;
        this.down = false;
    }
}
export class GameControls {
    constructor() {
        this.player1 = new PlayerControls();
        this.player2 = new PlayerControls();
    }
}

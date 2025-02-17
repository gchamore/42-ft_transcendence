export class PlayerControls {
	up: boolean = false;
	down: boolean = false;

	constructor() {
		this.up = false;
		this.down = false;
	}
}

export class GameControls {
	player1: PlayerControls;
	player2: PlayerControls;

	constructor() {
		this.player1 = new PlayerControls();
		this.player2 = new PlayerControls();
	}
}
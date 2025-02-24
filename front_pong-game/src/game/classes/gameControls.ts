import { Paddle } from './paddle';

export class PlayerControls {
	up: boolean = false;
	down: boolean = false;
}

export class GameControls {
	player1: PlayerControls;
	player2: PlayerControls;	
	paddle1: Paddle;
	paddle2: Paddle;
	private socket!: WebSocket;
	private playerNumber: number;

	constructor(paddle1: Paddle, paddle2: Paddle, playerNumber: number, socket: WebSocket) {
		this.player1 = new PlayerControls();
		this.player2 = new PlayerControls();
		this.paddle1 = paddle1;
		this.paddle2 = paddle2;
		this.playerNumber = playerNumber;
		this.socket = socket;
	}

	handleKeyDown(event: KeyboardEvent): void {
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
		this.sendPaddleMoves();
	}

	handleKeyUp(event: KeyboardEvent): void {
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
		this.sendPaddleMoves();
	}

	sendPaddleMoves(): void {
		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			if (this.playerNumber === 1) {
				this.socket.send(JSON.stringify({
					type: 'paddleMoves',
					player: 1,
					y: this.paddle1.y,
				}));
			} else if (this.playerNumber === 2) {
				this.socket.send(JSON.stringify({
					type: 'paddleMoves',
					player: 2,
					y: this.paddle2.y
				}));
			}
		}
	}
}

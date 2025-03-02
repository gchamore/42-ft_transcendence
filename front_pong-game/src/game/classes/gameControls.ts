import { Paddle } from './paddle';

export class PlayerControls {
	up: boolean = false;
	down: boolean = false;
}

export class GameControls {
	private upPressed: boolean = false;
	private downPressed: boolean = false;
	paddle: Paddle;
	private socket!: WebSocket;
	private playerNumber: number;
	private paddle1: Paddle;
	private paddle2: Paddle;

	constructor(paddle1: Paddle, paddle2: Paddle, playerNumber: number, socket: WebSocket) {
		this.playerNumber = playerNumber;
		this.paddle1 = paddle1;
		this.paddle2 = paddle2;
		this.paddle = playerNumber === 1 ? paddle1 : paddle2;
		this.socket = socket;
	}

	handleKeyDown(event: KeyboardEvent): void {
		switch (event.key) {
			case ' ':
				this.handleSpacePress();
				break;
			case 'w':
			case 'W':
			case 'ArrowUp':
                    this.upPressed = true;
                    this.sendPaddleMoves();
                break;
			case 's':
			case 'S':
			case 'ArrowDown':
				this.downPressed = true;
				this.sendPaddleMoves();
				break;
		}
	}

	private handleSpacePress(): void { 
		if (this.socket?.readyState === WebSocket.OPEN) {
			this.socket.send(JSON.stringify({
				type: 'startGame'
			}));
		}
	}

	handleKeyUp(event: KeyboardEvent): void {
		switch (event.key) {
			case 'w':
			case 'W':
			case 'ArrowUp':
                this.upPressed = false;
				this.sendPaddleMoves();
                break;
			case 's':
			case 'S':
			case 'ArrowDown':
				this.downPressed = false;
				this.sendPaddleMoves();
				break;
		}
	}

	sendPaddleMoves(): void {
		// Calculate new position based on key presses
		if (this.upPressed) {
			this.paddle.y -= this.paddle.speed;
		}
		if (this.downPressed) {
			this.paddle.y += this.paddle.speed;
		}

		// Keep paddle in bounds
		if (this.paddle.y < 0) {
			this.paddle.y = 0;
		}
		if (this.paddle.y + this.paddle.height > 600) {
			this.paddle.y = 600 - this.paddle.height;
		}

		// Send updated position to server
		if (this.socket?.readyState === WebSocket.OPEN && (this.upPressed || this.downPressed)) {
			console.log(`Sending paddle ${this.playerNumber} position:`, this.paddle.y);
			this.socket.send(JSON.stringify({
				type: 'movePaddle',
				player: this.playerNumber,
				y: this.paddle.y
			}));
		}
	}

	handleDisconnect(): void {
		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			this.socket.send(JSON.stringify({
				type: 'playerDisconnect',
				player: this.playerNumber,
				message: `Player ${this.playerNumber} disconnected`
			}));
		}
	}

	setPlayerNumber(playerNumber: number): void {
		this.playerNumber = playerNumber;
		this.paddle = playerNumber === 1 ? this.paddle1 : this.paddle2;
	}
}

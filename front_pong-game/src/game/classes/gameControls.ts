import { Paddle } from './paddle';

export class PlayerControls {
	up: boolean = false;
	down: boolean = false;
}

export class GameControls {
	private upPressed: boolean = false;
	private downPressed: boolean = false;
	private moveIntervalId: number | null = null;
	paddle: Paddle;
	private socket!: WebSocket;
	private playerNumber: number;
	private paddle1: Paddle;
	private paddle2: Paddle;
	private lastUpdateTime: number = 0;
    private readonly updateInterval: number = 50; // 20 updates per second (ms)
    private pendingUpdate: boolean = false;

	constructor(paddle1: Paddle, paddle2: Paddle, playerNumber: number, socket: WebSocket) {
		this.playerNumber = playerNumber;
		this.paddle1 = paddle1;
		this.paddle2 = paddle2;
		this.paddle = playerNumber === 1 ? paddle1 : paddle2;
		this.socket = socket;
	}

	public isMoving(): boolean {
		return this.upPressed || this.downPressed;
	}

	handleKeyDown(event: KeyboardEvent): void {
		let changed = false;

		switch (event.key) {
			case ' ':
				this.handleSpacePress();
				break;
			case 'w':
			case 'W':
			case 'ArrowUp':
				if (!this.upPressed) {
                    this.upPressed = true;
                    changed = true;
				}
                break;
			case 's':
			case 'S':
			case 'ArrowDown':
				if (!this.downPressed) {
					this.downPressed = true;
					changed = true;
				}
				break;
		}
		if (changed) {
			this.sendPaddleMoves();
			this.startContinuousMove();
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
		let changed = false;

		switch (event.key) {
			case 'w':
			case 'W':
			case 'ArrowUp':
                if (this.upPressed) {
					this.upPressed = false;
					changed = true;
				}
                break;
			case 's':
			case 'S':
			case 'ArrowDown':
				if (this.downPressed) {
					this.downPressed = false;
					changed = true;
				}
				break;
		}
		if (changed) {
			this.sendPaddleMoves();

			if (!this.upPressed && !this.downPressed) {
				this.stopContinuousMove();
			}
		}
	}

	// start continuous movement of paddle
	private startContinuousMove(): void {
        this.stopContinuousMove();
        
        // Process local movement at 60fps for smooth visuals
        this.moveIntervalId = window.setInterval(() => {
            if (this.upPressed || this.downPressed) {
                // Always apply local movement
                if (this.upPressed) {
                    this.paddle.y += this.paddle.speed;
                }
                if (this.downPressed) {
                    this.paddle.y -= this.paddle.speed;
                }
                
                // Keep paddle in bounds
                if (this.paddle.y < 0) {
                    this.paddle.y = 0;
                }
                if (this.paddle.y + this.paddle.height > 600) {
                    this.paddle.y = 600 - this.paddle.height;
                }
                
                // Only send to server at controlled rate
                const now = performance.now();
                if (now - this.lastUpdateTime >= this.updateInterval) {
                    if (this.socket?.readyState === WebSocket.OPEN) {
                        this.socket.send(JSON.stringify({
                            type: 'movePaddle',
                            player: this.playerNumber,
                            y: this.playerNumber === 1 ? this.paddle1.y : this.paddle2.y
                        }));
                        this.lastUpdateTime = now;
                        this.pendingUpdate = false;
                    }
                } else {
                    this.pendingUpdate = true;
                }
            }
        }, 1000 / 60); // 60fps for smooth local movement
    }

	private stopContinuousMove(): void {
		if (this.moveIntervalId) {
			window.clearInterval(this.moveIntervalId);
			this.moveIntervalId = null;
			
			// Send final position if there's a pending update
			if (this.pendingUpdate) {
				this.socket.send(JSON.stringify({
					type: 'movePaddle',
					player: this.playerNumber,
					y: this.playerNumber === 1 ? this.paddle1.y : this.paddle2.y
				}));
				this.pendingUpdate = false;
			}
		}
	}

	sendPaddleMoves(): void {
		if (!this.paddle) return;

		// Calculate new position based on key presses
		if (this.upPressed) {
			this.paddle.y += this.paddle.speed;
		}
		if (this.downPressed) {
			this.paddle.y -= this.paddle.speed;
		}

		// Keep paddle in bounds
		if (this.paddle.y < 0) {
			this.paddle.y = 0;
		}
		if (this.paddle.y + this.paddle.height > 600) {
			this.paddle.y = 600 - this.paddle.height;
		}

		// Throttle WebSocket messages
		const now = performance.now();
		if (now - this.lastUpdateTime >= this.updateInterval) {
			// Only send if enough time has passed
			if (this.socket?.readyState === WebSocket.OPEN) {
				this.socket.send(JSON.stringify({
					type: 'movePaddle',
					player: this.playerNumber,
					y: this.playerNumber === 1 ? this.paddle1.y : this.paddle2.y
				}));
				this.lastUpdateTime = now;
				this.pendingUpdate = false;
			}
		} else {
			// Mark that we have a pending update
			this.pendingUpdate = true;
		}
	}

	setPlayerNumber(playerNumber: number): void {
		this.playerNumber = playerNumber;
		this.paddle = playerNumber === 1 ? this.paddle1 : this.paddle2;
	}

	// Correct paddle position if server rejects movement
	syncPaddlePosition(serverPosition: number): void {
		if (!this.paddle) return;

		this.paddle.y = serverPosition;

		console.log('Paddle position corrected to:', serverPosition);

		// temporarily disable key presses to prevent immediate re-correction
		const wasUpPressed = this.upPressed;
		const wasDownPressed = this.downPressed;

		this.upPressed = false;
		this.downPressed = false;

		setTimeout(() => {
			// restore key presses
			this.upPressed = wasUpPressed;
			this.downPressed = wasDownPressed;
		}, 100);
	}
}

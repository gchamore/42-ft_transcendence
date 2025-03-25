import { Paddle } from './paddle';
import { Ball } from './ball';
import { PaddleInput, ServerPaddleState } from '../../types/gameTypes';
import { BabylonManager } from '../managers/babylonManager';

export class GameControls {
	localPaddle: Paddle;
	remotePaddle: Paddle;
	ball: Ball;
	private keysPressed: { [key: string]: boolean } = {};
	private lastFrameTime: number = 0;
	private socket!: WebSocket;
	private playerNumber: number;
	private inputSequence: number = 1;
	private inputHistory: PaddleInput[] = [];
	private remotePaddleBuffer: { time: number; position: number }[] = [];
	private paddleInterpolationDelay: number = 100;
	private ballPositionBuffer: { time: number; position: { x: number, y: number}; speedX: number; speedY: number }[] = [];
	private ballInterpolationDelay: number = 50;

	private babylonManager: BabylonManager;

	private visibilityChangeHandler: () => void;
	private windowBlurHandler: () => void;

	constructor(
		paddle1: Paddle,
		paddle2: Paddle,
		ball: Ball,
		playerNumber: number,
		socket: WebSocket,
		babylonManager: BabylonManager
	) {
		this.playerNumber = playerNumber;
		this.localPaddle = playerNumber === 1 ? paddle1 : paddle2;
		this.remotePaddle = playerNumber === 1 ? paddle2 : paddle1;
		this.ball = ball;
		this.socket = socket;
		this.babylonManager = babylonManager;
		this.lastFrameTime = performance.now();
		this.visibilityChangeHandler = this.handleVisibilityChange.bind(this);
		this.windowBlurHandler = this.handleWindowBlur.bind(this);
		document.addEventListener('visibilitychange', this.visibilityChangeHandler);
		window.addEventListener('blur', this.windowBlurHandler.bind(this));
	}

	handleKeyDown(event: KeyboardEvent): void {
		switch (event.key) {
			case " ":
				this.handleSpacePress();
				break;
			case "w":
			case "W":
			case "ArrowUp":
				this.keysPressed[event.key] = true;
				break;
			case "s":
			case "S":
			case "ArrowDown":
				this.keysPressed[event.key] = true;
				break;
		}
	}

	private handleSpacePress(): void {
		if (this.socket?.readyState === WebSocket.OPEN) {
			this.socket.send(
				JSON.stringify({
					type: "startGame",
				})
			);
		}
	}

	handleKeyUp(event: KeyboardEvent): void {
		switch (event.key) {
			case "w":
			case "W":
			case "ArrowUp":
				delete this.keysPressed[event.key];
				if (!this.isAnyMovementKeyPressed()) {
					this.localPaddle.velocity = 0;
					this.sendPaddleMovements();
				}
				break;
			case "s":
			case "S":
			case "ArrowDown":
				delete this.keysPressed[event.key];
				if (!this.isAnyMovementKeyPressed()) {
					this.localPaddle.velocity = 0;
					this.sendPaddleMovements();
				}
				break;
		}
	}

	private isAnyMovementKeyPressed(): boolean {
		return (
			this.keysPressed["w"] ||
			this.keysPressed["W"] ||
			this.keysPressed["s"] ||
			this.keysPressed["S"] ||
			this.keysPressed["ArrowUp"] ||
			this.keysPressed["ArrowDown"]
		);
	}

	public update(timestamp: number): void {
		const deltaTime = timestamp - this.lastFrameTime;
		this.lastFrameTime = timestamp;
		
		this.processInput(deltaTime);
		this.updateRemotePaddlePosition();
		this.updateBallPosition();
	}

	private processInput(deltaTime: number): void {
		let needsUpdate = false;
		let oldVelocity = this.localPaddle.velocity;

		if (
			this.keysPressed["w"] ||
			this.keysPressed["W"] ||
			this.keysPressed["ArrowUp"]
		) {
			this.localPaddle.velocity = -this.localPaddle.speed;
			needsUpdate = true;
		}
		else if (
			this.keysPressed["s"] ||
			this.keysPressed["S"] ||
			this.keysPressed["ArrowDown"]
		) {
			this.localPaddle.velocity = this.localPaddle.speed;
			needsUpdate = true;
		}

		if (needsUpdate || oldVelocity !== 0) {
			this.sendPaddleMovements(deltaTime);
		}
	}

	private sendPaddleMovements(deltaTime: number = 16.67): void {
		this.updateLocalPaddlePosition(deltaTime);

		const input: PaddleInput = {
			inputSequence: this.inputSequence,
			paddlePosition: this.localPaddle.y,
		};

		this.inputHistory.push(input);

		this.safeSend(this.socket, {
			type: "movePaddle",
			playerNumber: this.playerNumber,
			paddlePosition: this.localPaddle.y,
			inputSequence: this.inputSequence,
		});
		this.inputSequence++;
		this.babylonManager.renderLocalPaddle();
	}

	private safeSend(socket: WebSocket, message: any) {
		if (socket.readyState === WebSocket.OPEN) {
			try {
				const jsonMessage = JSON.stringify(message);
				socket.send(jsonMessage);
			} catch (e) {
				console.error("Error sending message:", e);
			}
		} else {
			console.warn("Cannot send message, socket state:", {
				current: socket.readyState,
				states: {
					CONNECTING: WebSocket.CONNECTING,
					OPEN: WebSocket.OPEN,
					CLOSING: WebSocket.CLOSING,
					CLOSED: WebSocket.CLOSED,
				},
				expectedState: `OPEN (${WebSocket.OPEN})`,
			});
		}
	}

	private updateLocalPaddlePosition(deltaTime: number): void {
		this.localPaddle.move(deltaTime);
	}

	public updateRemotePaddlePosition(): void {
		const now = performance.now();

		// Return if the buffer is empty or has only one entry
		if (this.remotePaddleBuffer.length < 2) {
			return;
		}

		// Clean old positions from the buffer
		while (this.remotePaddleBuffer.length > 2 &&
			now > this.remotePaddleBuffer[1].time + this.paddleInterpolationDelay) {
			this.remotePaddleBuffer.shift();
		}

		// Get the two positions to interpolate between
		const targetTime = now - this.paddleInterpolationDelay;

		// Find the two buffer entries surrounding our target time
		let prev = this.remotePaddleBuffer[0];
		let next = this.remotePaddleBuffer[1];

		// If we're still interpolating between these points
		if (targetTime <= next.time && targetTime >= prev.time) {
			// Calculate how far we are between the two positions (0 to 1)
			const timeFactor = (targetTime - prev.time) / (next.time - prev.time);

			// Use a smoothing function for interpolation
			// Cubic ease-in-out gives smoother acceleration/deceleration
			const t = this.cubicEaseInOut(timeFactor);

			// Linear interpolation between positions with smoothing factor
			this.remotePaddle.y = prev.position * (1 - t) + next.position * t;
		}
		// If we're past the next position in our buffer
		else if (targetTime > next.time) {
			// Look ahead in the buffer if there are more positions
			for (let i = 1; i < this.remotePaddleBuffer.length - 1; i++) {
				if (targetTime <= this.remotePaddleBuffer[i + 1].time &&
					targetTime >= this.remotePaddleBuffer[i].time) {
					prev = this.remotePaddleBuffer[i];
					next = this.remotePaddleBuffer[i + 1];

					const timeFactor = (targetTime - prev.time) / (next.time - prev.time);
					const t = this.cubicEaseInOut(timeFactor);
					this.remotePaddle.y = prev.position * (1 - t) + next.position * t;
					return;
				}
			}

			// If we're past all buffer positions, use the latest
			if (this.remotePaddleBuffer.length > 0) {
				this.remotePaddle.y = this.remotePaddleBuffer[this.remotePaddleBuffer.length - 1].position;
			}
		}
	}

	private cubicEaseInOut(t: number): number {
		t = Math.max(0, Math.min(1, t));
		return 0.5 * (1 - Math.cos(t * Math.PI));
	}

	public updateServerPaddlePosition(
		serverPaddle1: ServerPaddleState,
		serverPaddle2: ServerPaddleState
	): void {
		const serverLocalPaddle =
			this.playerNumber === 1 ? serverPaddle1 : serverPaddle2;
		const serverRemotePaddle =
			this.playerNumber === 1 ? serverPaddle2 : serverPaddle1;

		// need to interpolate the remote paddle position
		this.storeRemotePosition(serverRemotePaddle);

		// Reconcile local paddle with server position
		this.reconcilePaddlePosition(serverLocalPaddle);
	}

	private storeRemotePosition(serverRemotePaddle: ServerPaddleState): void {
		const now = performance.now();
		this.remotePaddleBuffer.push({
			time: now,
			position: serverRemotePaddle.y,
		});
		while (this.remotePaddleBuffer.length > 10) {
			this.remotePaddleBuffer.shift();
		}
	}
	
	// Reconcile local paddle with server position to avoid Jitter (blocked movement, backward movement)
	private reconcilePaddlePosition(
		serverLocalPaddle: ServerPaddleState
	): void {
		this.localPaddle.lastProcessedInput =
		serverLocalPaddle.lastProcessedInput;
		// reset paddle position to authoritative server position
		this.localPaddle.y = serverLocalPaddle.y;
		// remove inputs that have already been processed by the server
		this.inputHistory = this.inputHistory.filter(
			(input) =>
				input.inputSequence > serverLocalPaddle.lastProcessedInput
		);
		// replace unacknowledged inputs to correct local paddle position
		if (this.inputHistory.length > 0) {
			// Sort by sequence number to ensure proper order
			this.inputHistory.sort((a, b) => a.inputSequence - b.inputSequence);
			
			// Apply each unprocessed input
			this.inputHistory.forEach((input) => {
				// Move the paddle directly to the cached position
				this.localPaddle.y = input.paddlePosition;
				// Don't update lastProcessedInput here - that comes from the server
			});
		}
	}

	public storeBallPosition(serverBall: { x: number, y: number, speedX: number, speedY: number, radius?: number }): void {
		const now = performance.now();
		this.ballPositionBuffer.push({
			time: now,
			position: { x: serverBall.x, y: serverBall.y },
			speedX: serverBall.speedX,
			speedY: serverBall.speedY,
		});
		while (this.ballPositionBuffer.length > 10) {
			this.ballPositionBuffer.shift();
		}
	}

	private updateBallPosition(): void {
		const now = performance.now();

		// Return if the buffer is empty or has only one entry
		if (this.ballPositionBuffer.length < 2) {
			return;
		}

		// Clean old positions from the buffer
		while (this.ballPositionBuffer.length > 2 &&
			now > this.ballPositionBuffer[1].time + this.ballInterpolationDelay) {
			this.ballPositionBuffer.shift();
		}

		// Get the two positions to interpolate between
		const targetTime = now - this.ballInterpolationDelay;

		// Find the two buffer entries surrounding our target time
		let prev = this.ballPositionBuffer[0];
		let next = this.ballPositionBuffer[1];

		// If we're still interpolating between these points
		if (targetTime <= next.time && targetTime >= prev.time) {
			// Calculate how far we are between the two positions (0 to 1)
			const timeFactor = (targetTime - prev.time) / (next.time - prev.time);

			// Use a smoothing function for interpolation
			const t = this.cubicEaseInOut(timeFactor);

			// Linear interpolation between actual positions 
			this.ball.x = prev.position.x * (1 - t) + next.position.x * t;
			this.ball.y = prev.position.y * (1 - t) + next.position.y * t;
			return;
		}
		// If we're past the next position in our buffer
		else if (targetTime > next.time) {
			// Look ahead in the buffer if there are more positions
			for (let i = 1; i < this.ballPositionBuffer.length - 1; i++) {
				if (targetTime <= this.ballPositionBuffer[i + 1].time &&
					targetTime >= this.ballPositionBuffer[i].time) {
					prev = this.ballPositionBuffer[i];
					next = this.ballPositionBuffer[i + 1];

					const timeFactor = (targetTime - prev.time) / (next.time - prev.time);
					const t = this.cubicEaseInOut(timeFactor);

					this.ball.x  = prev.position.x * (1 - t) + next.position.x * t;
					this.ball.y = prev.position.y * (1 - t) + next.position.y * t;
					return;
				}
			}
			// If we're past all buffer positions, use the latest + velocity projection
			if (this.ballPositionBuffer.length > 0) {
				const latest = this.ballPositionBuffer[this.ballPositionBuffer.length - 1];
				const timeElapsed = (now - latest.time) / 1000;

				// Use velocity to predict current position
				this.ball.x = latest.position.x + latest.speedX * timeElapsed;
				this.ball.y = latest.position.y + latest.speedY * timeElapsed;
			}
		}
	}


	private handleVisibilityChange(): void {
		if (document.visibilityState === 'hidden') {
			this.resetKeyState();
		}
	}

	private handleWindowBlur(): void {
		this.resetKeyState();
	}

	private resetKeyState(): void {
		this.keysPressed = {};
		this.localPaddle.velocity = 0;
		this.sendPaddleMovements();
	}

	public dispose(): void {
		document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
		window.removeEventListener('blur', this.windowBlurHandler);
	}
}

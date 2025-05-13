import { Paddle } from './paddle';
import { Ball } from './ball';
import { PaddleInput, ServerPaddleState } from '../../types/gameTypes';
import { BabylonManager } from '../managers/babylonManager';
import { GameConfig } from "../../../shared/config/gameConfig.js";

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
	private remotePaddleBuffer: { time: number; position: number; height: number; speed: number }[] = [];
	private paddleInterpolationDelay: number = 100;
	private ballPositionBuffer: { time: number; position: { x: number, y: number }; speedX: number; speedY: number }[] = [];
	private ballInterpolationDelay: number = 150;

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
			case "d":
			case "D":
			case "ArrowRight":
				this.keysPressed[event.key] = true;
				break;
			case "a":
			case "A":
			case "ArrowLeft":
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
			case "d":
			case "D":
			case "ArrowRight":
				delete this.keysPressed[event.key];
				if (!this.isAnyMovementKeyPressed()) {
					this.localPaddle.velocity = 0;
					this.sendPaddleMovements();
				}
				break;
				case "a":
					case "A":
					case "ArrowLeft":
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
			this.keysPressed["d"] ||
			this.keysPressed["D"] ||
			this.keysPressed["a"] ||
			this.keysPressed["A"] ||
			this.keysPressed["ArrowRight"] ||
			this.keysPressed["ArrowLeft"]
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
			this.keysPressed["d"] ||
			this.keysPressed["D"] ||
			this.keysPressed["ArrowRight"]
		) {
			this.localPaddle.velocity = -this.localPaddle.speed;
			if (this.playerNumber === 2)
				this.localPaddle.velocity *= -1;
			needsUpdate = true;
		}
		else if (
			this.keysPressed["a"] ||
			this.keysPressed["A"] ||
			this.keysPressed["ArrowLeft"]
		) {
			this.localPaddle.velocity = this.localPaddle.speed;
			if (this.playerNumber === 2)
				this.localPaddle.velocity *= -1;
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
			// console.log("Cannot send message, socket state:", {
			// 	current: socket.readyState,
			// 	states: {
			// 		CONNECTING: WebSocket.CONNECTING,
			// 		OPEN: WebSocket.OPEN,
			// 		CLOSING: WebSocket.CLOSING,
			// 		CLOSED: WebSocket.CLOSED,
			// 	},
			// 	expectedState: `OPEN (${WebSocket.OPEN})`,
			// });
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
			this.remotePaddle.height = next.height;
			this.remotePaddle.speed = next.speed;
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
					this.remotePaddle.height = next.height;
					this.remotePaddle.speed = next.speed;
					return;
				}
			}

			// If we're past all buffer positions, use the latest
			if (this.remotePaddleBuffer.length > 0) {
				this.remotePaddle.y = this.remotePaddleBuffer[this.remotePaddleBuffer.length - 1].position;
				this.remotePaddle.height = this.remotePaddleBuffer[this.remotePaddleBuffer.length - 1].height;
				this.remotePaddle.speed = this.remotePaddleBuffer[this.remotePaddleBuffer.length - 1].speed;
			}
		}
	}

	// Cubic ease-in-out function for smoother interpolation
	private cubicEaseInOut(t: number): number {
		t = Math.max(0, Math.min(1, t));
		return 0.5 * (1 - Math.cos(t * Math.PI));
	}

	public updateServerPaddlePosition(serverPaddle1: ServerPaddleState, serverPaddle2: ServerPaddleState): void {
		const serverLocalPaddle = this.playerNumber === 1 ? serverPaddle1 : serverPaddle2;
		const serverRemotePaddle = this.playerNumber === 1 ? serverPaddle2 : serverPaddle1;

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
			height: serverRemotePaddle.height,
			speed: serverRemotePaddle.speed,
		});
		while (this.remotePaddleBuffer.length > 10) {
			this.remotePaddleBuffer.shift();
		}
	}

	// Reconcile local paddle with server position to avoid Jitter (blocked movement, backward movement)
	private reconcilePaddlePosition(serverLocalPaddle: ServerPaddleState): void {
		this.localPaddle.lastProcessedInput = serverLocalPaddle.lastProcessedInput;
		this.localPaddle.height = serverLocalPaddle.height;
		this.localPaddle.speed = serverLocalPaddle.speed;

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
				this.localPaddle.y = input.paddlePosition;
			});
		}
	}

	public storeBallPosition(serverBall: { x: number, y: number, speedX: number, speedY: number, radius?: number }): void {
		const now = performance.now();

		// Reset buffer if there's a big jump (e.g., after paddle hit)
		const last = this.ballPositionBuffer[this.ballPositionBuffer.length - 1];
		if (last && Math.hypot(serverBall.x - last.position.x, serverBall.y - last.position.y) > 50) {
			this.ballPositionBuffer = [];
		}

		this.ballPositionBuffer.push({
			time: now,
			position: { x: serverBall.x, y: serverBall.y },
			speedX: serverBall.speedX,
			speedY: serverBall.speedY,
		});

		// Keep only the last 10 positions
		const maxBufferSize = 10;
		if (this.ballPositionBuffer.length > maxBufferSize) {
			this.ballPositionBuffer = this.ballPositionBuffer.slice(-maxBufferSize);
		}
	}

	private updateBallPosition(): void {
		const now = performance.now();
		// Return if the buffer is empty or has only one entry
		if (this.ballPositionBuffer.length < 2) return (console.log("Ball position buffer too small"));

		// Get the two positions to interpolate between
		const targetTime = now - this.ballInterpolationDelay;

		// Find the best pair of points for interpolation
		let prev = null;
		let next = null;

		// Find the closest surrounding points
		for (let i = 0; i < this.ballPositionBuffer.length - 1; i++) {
			if (targetTime >= this.ballPositionBuffer[i].time &&
				targetTime <= this.ballPositionBuffer[i + 1].time) {
				prev = this.ballPositionBuffer[i];
				next = this.ballPositionBuffer[i + 1];
				break;
			}
		}

		// If we found appropriate interpolation points
		if (prev && next) {
			console.log(`interpolating`);
			// Calculate interpolation factor
			const timeFactor = (targetTime - prev.time) / (next.time - prev.time);
			const t = this.cubicEaseInOut(timeFactor);

			// Linear interpolation
			this.ball.x = prev.position.x * (1 - t) + next.position.x * t;
			this.ball.y = prev.position.y * (1 - t) + next.position.y * t;

		} else {
			console.log(`extrapolating`);
			const latest = this.ballPositionBuffer[this.ballPositionBuffer.length - 1];
			const isNearWall = this.isNearBoundary(latest.position.x, latest.position.y);

			if (!isNearWall && this.ballPositionBuffer.length >= 2) {
				const timeElapsed = (now - latest.time) / 1000;
				const safeTimeElapsed = Math.min(timeElapsed, 0.1);
				this.ball.x = latest.position.x + latest.speedX * safeTimeElapsed;
				this.ball.y = latest.position.y + latest.speedY * safeTimeElapsed;
			} else {
				// Near wall/paddle: do not extrapolate, just hold last known position

				this.ball.x = latest.position.x;
				this.ball.y = latest.position.y;
			}
		}

		// Periodically clean up (less frequently than each frame)
		if (now % 1000 < 16) { // Clean once per second approximately
			this.cleanupBuffer();
		}
	}

	private isNearBoundary(x: number, y: number): boolean {
		const ballRadius = this.ball.radius;
		const canvasWidth = GameConfig.CANVAS_WIDTH;
		const canvasHeight = GameConfig.CANVAS_HEIGHT;
		const leftPaddle = this.playerNumber === 1 ? this.localPaddle : this.remotePaddle;
		const rightPaddle = this.playerNumber === 1 ? this.remotePaddle : this.localPaddle;


		const nearTopWall = y - ballRadius < 10;
		const nearBottomWall = y + ballRadius > canvasHeight - 10;
		const nearLeftPaddle = x - ballRadius < leftPaddle.width + 10 && Math.abs(y - leftPaddle.y) < leftPaddle.height / 2 + 10;
		const nearRightPaddle = x + ballRadius > canvasWidth - rightPaddle.width - 10 && Math.abs(y - rightPaddle.y) < rightPaddle.height / 2 + 10;
		return nearTopWall || nearBottomWall || nearLeftPaddle || nearRightPaddle;
	}

	private cleanupBuffer(): void {
		const maxAgeMs = 1000; // Keep positions from last second
		const now = performance.now();
		this.ballPositionBuffer = this.ballPositionBuffer.filter(point =>
			now - point.time < maxAgeMs);
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

import { Paddle } from './paddle';
import { PaddleInput, ServerPaddleState } from '../../types/gameTypes';
import { BabylonManager } from '../managers/babylonManager';

export class GameControls {
	localPaddle: Paddle;
	remotePaddle: Paddle;
	private keysPressed: { [key: string]: boolean } = {};
	private lastFrameTime: number = 0;
	private socket!: WebSocket;
	private playerNumber: number;
	private inputSequence: number = 1;
	private inputHistory: PaddleInput[] = [];
	private remotePaddleBuffer: { time: number; position: number }[] = [];

	private babylonManager: BabylonManager;

	constructor(
		paddle1: Paddle,
		paddle2: Paddle,
		playerNumber: number,
		socket: WebSocket,
		babylonManager: BabylonManager
	) {
		this.playerNumber = playerNumber;
		this.localPaddle = playerNumber === 1 ? paddle1 : paddle2;
		this.remotePaddle = playerNumber === 1 ? paddle2 : paddle1;
		this.socket = socket;
		this.babylonManager = babylonManager;
		this.lastFrameTime = performance.now();
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
	}

	private processInput(deltaTime: number): void {
		let needsUpdate = false;
		let oldVelocity = this.localPaddle.velocity;

		// Check for upward movement
		if (
			this.keysPressed["w"] ||
			this.keysPressed["W"] ||
			this.keysPressed["ArrowUp"]
		) {
			this.localPaddle.velocity = -this.localPaddle.speed;
			needsUpdate = true;
		}
		// Check for downward movement (if no up keys are pressed)
		else if (
			this.keysPressed["s"] ||
			this.keysPressed["S"] ||
			this.keysPressed["ArrowDown"]
		) {
			this.localPaddle.velocity = this.localPaddle.speed;
			needsUpdate = true;
		}

		// Only send updates if movement is happening
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
		if (this.remotePaddleBuffer.length < 2) return;

		const [prev, next] = this.remotePaddleBuffer;

		if (now >= next.time) {
			this.remotePaddle.y = next.position;
			this.remotePaddleBuffer.shift();
		} else {
			const timeDiff = (now - prev.time) / (next.time - prev.time);
			this.remotePaddle.y =
				prev.position * (1 - timeDiff) + next.position * timeDiff;
		}
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
		if (this.remotePaddleBuffer.length > 3) {
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
}

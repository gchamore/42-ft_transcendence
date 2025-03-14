import { Paddle } from './paddle';
import { PaddleInput, ServerPaddleState } from '../../types/gameTypes';
import { BabylonManager } from '../managers/babylonManager';

export class GameControls {
	paddle: Paddle;
	private socket!: WebSocket;
	private playerNumber: number;
	private inputSequence: number = 1;
	private inputHistory: PaddleInput[] = [];
	private remotePaddleBuffer: { time: number, position: number }[] = [];

	private babylonManager: BabylonManager;

	constructor(paddle1: Paddle, paddle2: Paddle, playerNumber: number, socket: WebSocket, babylonManager: BabylonManager) {
		this.playerNumber = playerNumber;
		this.paddle = playerNumber === 1 ? paddle1 : paddle2;
		this.socket = socket;
		this.babylonManager = babylonManager;
	}

	handleKeyDown(event: KeyboardEvent): void {

		switch (event.key) {
			case ' ':
				this.handleSpacePress();
				break;
			case 'w':
			case 'W':
			case 'ArrowUp':
				this.paddle.velocity = this.paddle.speed;
				this.sendPaddleMovements();
                break;
			case 's':
			case 'S':
			case 'ArrowDown':
				this.paddle.velocity = -this.paddle.speed;
				this.sendPaddleMovements();
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
                this.paddle.velocity = 0;
				this.sendPaddleMovements();
                break;
			case 's':
			case 'S':
			case 'ArrowDown':
				this.paddle.velocity = 0;
				this.sendPaddleMovements();
				break;
		}
	}

	private sendPaddleMovements(): void {

		console.log('before moving Player', this.playerNumber, 'moved paddle to', this.paddle.y);
		this.updateLocalPaddlePosition();
		console.log('after moving Player', this.playerNumber, 'moved paddle to', this.paddle.y);
		
		const input: PaddleInput = {
			inputSequence: this.inputSequence,
			paddlePosition: this.paddle.y,
		};

		this.inputHistory.push(input);

		this.safeSend(this.socket, {
			type: 'movePaddle',
			playerNumber: this.playerNumber,
			paddlePosition: this.paddle.y,
			inputSequence: this.inputSequence
		});
		this.inputSequence++;
		this.babylonManager.render(performance.now());
	}

	private safeSend(socket: WebSocket, message: any) {
		if (socket.readyState === WebSocket.OPEN) {
			try {
				const jsonMessage = JSON.stringify(message);
				socket.send(jsonMessage);
			} catch (e) {
				console.error('Error sending message:', e);
			}
		} else {
			console.warn('Cannot send message, socket state:', {
				current: socket.readyState,
				states: {
					CONNECTING: WebSocket.CONNECTING,
					OPEN: WebSocket.OPEN,
					CLOSING: WebSocket.CLOSING,
					CLOSED: WebSocket.CLOSED
				},
				expectedState: `OPEN (${WebSocket.OPEN})`
			});
		}
	}

	private updateLocalPaddlePosition(): void {
		this.paddle.move();
	}

	public updateRemotePaddlePosition(): void {
		const now = performance.now();
		if (this.remotePaddleBuffer.length < 2) return;

		const [prev, next] = this.remotePaddleBuffer;

		if (now >= next.time) {
			this.paddle.y = next.position;
			this.remotePaddleBuffer.shift();
		} else {
			const timeDiff = (now - prev.time) / (next.time - prev.time);
			this.paddle.y = prev.position * (1 - timeDiff) + next.position * timeDiff;
		}
	}

	public updateServerPaddlePosition(serverPaddle1: ServerPaddleState, serverPaddle2: ServerPaddleState): void {
		const serverLocalPaddle = this.playerNumber === 1 ? serverPaddle1 : serverPaddle2;
		const serverRemotePaddle = this.playerNumber === 1 ? serverPaddle2 : serverPaddle1;
		
		// need to interpolate the remote paddle position
		this.storeRemotePosition(serverRemotePaddle);

		// // Reconcile local paddle with server position
		this.reconcilePaddlePosition(serverLocalPaddle);
	}
	
	private storeRemotePosition(serverRemotePaddle: ServerPaddleState): void {
		const now = performance.now();
		this.remotePaddleBuffer.push({ time: now, position: serverRemotePaddle.y });
		if (this.remotePaddleBuffer.length > 3) {
			this.remotePaddleBuffer.shift();
		}
	}

	// Reconcile local paddle with server position to avoid Jitter (blocked movement, backward movement)
	private reconcilePaddlePosition(serverLocalPaddle: ServerPaddleState): void {

		console.log('paddle position before server update', this.paddle.x, this.paddle.y, this.paddle.lastProcessedInput);
		// reset paddle position to authoritative server position
		this.paddle.y = serverLocalPaddle.y;
		console.log('paddle position after server update', this.paddle.x, this.paddle.y, this.paddle.lastProcessedInput);
		// remove inputs that have already been processed by the server
		this.inputHistory = this.inputHistory.filter(input => input.inputSequence > serverLocalPaddle.lastProcessedInput);
		// replace unacknowledged inputs to correct local paddle position
		this.inputHistory.forEach(input => {
			this.paddle.y = input.paddlePosition;
		});
		console.log('paddle position after input replay', this.paddle.x, this.paddle.y, this.paddle.lastProcessedInput);
	}

}

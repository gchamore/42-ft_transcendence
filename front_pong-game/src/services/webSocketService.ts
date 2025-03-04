export class WebSocketService {
	private static instance: WebSocketService;
	private socket: WebSocket | null = null;

	private constructor() { }

	public static getInstance(): WebSocketService {
		if (!WebSocketService.instance) {
			WebSocketService.instance = new WebSocketService();
		}
		return WebSocketService.instance;
	}

	public getSocket(): WebSocket | null {
		return this.socket;
	}

	public connect(gameId: string): WebSocket {
		// Close existing socket if it exists
		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			console.log('Reusing existing WebSocket connection');
			return this.socket;
		}

		console.log(`Creating new WebSocket connection for game: ${gameId}`);
		this.socket = new WebSocket(`ws://localhost:3000/game/${gameId}`);
		return this.socket;
	}

	public close(): void {
		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			this.socket.close(1000, "Application closing");
			this.socket = null;
		}
	}
}

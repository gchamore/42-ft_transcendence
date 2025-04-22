export interface GameState {
	gameId: string;
	gameStarted: boolean;
	servingPlayer: number;
	paddle1: {
		x: number;
		y: number;
		width: number;
		height: number;
		speed: number;
		velocity: number;
		lastProcessedInput: number;
		originalHeight?: number;
	};
	paddle2: {
		x: number;
		y: number;
		width: number;
		height: number;
		speed: number;
		velocity: number;
		lastProcessedInput: number;
		originalHeight?: number;
	};
	ball: {
		x: number;
		y: number;
		radius: number;
		speedX: number;
		speedY: number;
		originalRadius?: number;
	};
	score: {
		player1Score: number;
		player2Score: number;
	};
}

export const createDefaultGameState = (gameId: string = ''): GameState => ({
	gameId,
	gameStarted: false,
	servingPlayer: Math.random() < 0.5 ? 1 : 2,
	paddle1: { x: 10, y: 250, width: 10, height: 150, speed: 5, velocity: 0, lastProcessedInput: 0 },
	paddle2: { x: 780, y: 250, width: 10, height: 150, speed: 5, velocity: 0, lastProcessedInput: 0 },
	ball: { x: 400, y: 300, radius: 10, speedX: 4, speedY: 4 },
	score: { player1Score: 0, player2Score: 0 }
});

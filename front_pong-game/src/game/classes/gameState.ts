export interface GameState {
	gameStarted: boolean;
	servingPlayer: number;
	playerNumber: number;
	paddle1: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
	paddle2: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
	ball: {
		x: number;
		y: number;
		radius: number;
		speedX: number;
		speedY: number;
	};
	score: {
		player1Score: number;
		player2Score: number;
	};
}
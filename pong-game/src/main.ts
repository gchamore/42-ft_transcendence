import { Game } from './Game';


document.addEventListener('DOMContentLoaded', () => {
	try {
		const game = new Game();
		game.start();
	} catch (error) {
		console.error(error);
	}
});














window.addEventListener('keydown', (event: KeyboardEvent) => {
	if (event.code === 'Space' && !gameStarted) {
		serveBall();
	}
});

function updatePaddles() {
	if (controls.player1.up && paddle1.y > 0) {
		paddle1.y -= paddleSpeed;
	}
	if (controls.player1.down && paddle1.y + paddle1.height < canvas.height) {
		paddle1.y += paddleSpeed;
	}
	
	if (controls.player2.up && paddle2.y > 0) {
		paddle2.y -= paddleSpeed;
	}
	if (controls.player2.down && paddle2.y + paddle2.height < canvas.height) {
		paddle2.y += paddleSpeed;
	}
}

// Basic game loop function
function gameLoop(timestamp: number) {
	// Clear the canvas
	context.clearRect(0, 0, canvas.width, canvas.height);
	
	// Draw paddles
	context.fillStyle = "white";
	context.fillRect(paddle1.x, paddle1.y, paddle1.width, paddle1.height);
	context.fillRect(paddle2.x, paddle2.y, paddle2.width, paddle2.height);
	updatePaddles();

	// Draw the start message
	drawStartMessage(timestamp);

	// Update the ball position
	if (gameStarted) {
		ball.x += ball.speedX;
		ball.y += ball.speedY;
	}

	// Draw ball
	context.beginPath();
	context.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
	context.fillStyle = "white";
	context.fill();
	context.closePath();

	if (ball.x < 0) {
		scoreBoard.incrementPlayer2();
		const winner = scoreBoard.checkWinner();
		if (winner) {
			alert(`Game is over, ${winner} wins!`);
			scoreBoard.reset();
		}
		servingPlayer = 1;
		resetBall();
	} else if (ball.x > canvas.width) {
		scoreBoard.incrementPlayer1();
		const winner = scoreBoard.checkWinner();
		if (winner) {
			alert(`Game is over, ${winner} wins!`);
			scoreBoard.reset();
		}
		servingPlayer = 2;
		resetBall();
	}

	

	// Ball bouncing off paddles
	if (ball.x - ball.radius <= paddle1.x + paddle1.width &&
		ball.y >= paddle1.y &&
		ball.y <= paddle1.y + paddle1.height &&
		ball.speedX < 0) {
		handlePaddleCollision(ball, paddle1);
	}

	if (ball.x + ball.radius >= paddle2.x &&
		ball.y >= paddle2.y &&
		ball.y <= paddle2.y + paddle2.height &&
		ball.speedX > 0) {
		handlePaddleCollision(ball, paddle2);
	}
	// Call the game loop again
	requestAnimationFrame(gameLoop);
}

function initGame() {
	loadSettings();
	requestAnimationFrame(gameLoop);
}

initGame();
// Get the canvas element and its context
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const context = canvas.getContext('2d')!; // Non-null assertion operator might need to check this

// Initialize the ball and paddles
let ball = { x: 400, y: 300, radius: 10, speedX: 4, speedY: 4 };
let paddle1 = { x: 10, y: 250, width: 10, height: 100 };
let paddle2 = { x: 780, y: 250, width: 10, height: 100 };


const paddleSpeed = 5;

let player1Up = false;
let player1Down = false;
let player2Up = false;
let player2Down = false;

window.addEventListener('keydown', (event) => {
	if (event.key === 'w') {
		player1Up = true;
	}
	if (event.key === 's') {
		player1Down = true;
	}
	if (event.key === 'ArrowUp') {
		player2Up = true;
	}
	if (event.key === 'ArrowDown') {
		player2Down = true;
	}
});

window.addEventListener('keyup', (event) => {
	if (event.key === 'w') {
		player1Up = false;
	}
	if (event.key === 's') {
		player1Down = false;
	}
	if (event.key === 'ArrowUp') {
		player2Up = false;
	}
	if (event.key === 'ArrowDown') {
		player2Down = false;
	}
});

function updatePaddles() {
	if (player1Up && paddle1.y > 0) {
		paddle1.y -= paddleSpeed;
	}
	if (player1Down && paddle1.y + paddle1.height < canvas.height) {
		paddle1.y += paddleSpeed;
	}

	if (player2Up && paddle2.y > 0) {
		paddle2.y -= paddleSpeed;
	}
	if (player2Down && paddle2.y + paddle2.height < canvas.height) {
		paddle2.y += paddleSpeed;
	}
}

// Basic game loop function
function gameLoop() {
    // Clear the canvas
    context.clearRect(0, 0, canvas.width, canvas.height);

	updatePaddles();

    // Update ball position
    ball.x += ball.speedX;
    ball.y += ball.speedY;

    // Draw ball
    context.beginPath();
    context.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    context.fillStyle = "white";
    context.fill();
    context.closePath();

    // Draw paddles
    context.fillStyle = "white";
    context.fillRect(paddle1.x, paddle1.y, paddle1.width, paddle1.height);
    context.fillRect(paddle2.x, paddle2.y, paddle2.width, paddle2.height);

    // Ball bouncing off top and bottom walls
    if (ball.y <= 0 || ball.y >= canvas.height) {
        ball.speedY = -ball.speedY;
    }

    // Ball bouncing off paddles (basic check)
    if (ball.x - ball.radius <= paddle1.x + paddle1.width && ball.y >= paddle1.y && ball.y <= paddle1.y + paddle1.height) {
        ball.speedX = -ball.speedX;
    }

    if (ball.x + ball.radius >= paddle2.x && ball.y >= paddle2.y && ball.y <= paddle2.y + paddle2.height) {
        ball.speedX = -ball.speedX;
    }

    // Call the game loop again
    requestAnimationFrame(gameLoop);
}

// Start the game loop
gameLoop();

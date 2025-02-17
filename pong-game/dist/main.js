import { Paddle } from './Paddle.js';
import { Ball } from './Ball.js';
import { GameControls } from './PlayerControls.js';
import { ScoreBoard } from './ScoreBoard.js';
// Get the canvas element and its context
const canvas = document.getElementById('gameCanvas');
const context = canvas.getContext('2d'); // Non-null assertion operator might need to check this
const MIN_VERTICAL_SPEED = 2;
// Initialize the ball and paddles
const ball = new Ball(400, 300, 10, 4);
let paddle1 = new Paddle(10, canvas.height / 2, 10, 100);
let paddle2 = new Paddle(780, canvas.height / 2, 10, 100);
const WINNING_SCORE = 5;
const scoreBoard = new ScoreBoard(WINNING_SCORE);
let paddleSpeed = 5;
let gameStarted = false;
let servingPlayer = Math.random() < 0.5 ? 1 : 2;
const ballSpeedSlider = document.getElementById('ball-speed');
const ballSpeedValue = document.getElementById('ball-speed-value');
const paddleLengthSlider = document.getElementById('paddle-length');
const paddleLengthValue = document.getElementById('paddle-length-value');
const paddleSpeedSlider = document.getElementById('paddle-speed');
const paddleSpeedValue = document.getElementById('paddle-speed-value');
const controls = new GameControls();
function loadSettings() {
    const savedBallSpeed = localStorage.getItem('ballSpeed');
    const savedPaddleLength = localStorage.getItem('paddleLength');
    const savedPaddleSpeed = localStorage.getItem('paddleSpeed');
    if (savedBallSpeed) {
        ballSpeedSlider.value = savedBallSpeed;
        ballSpeedValue.innerText = savedBallSpeed;
        ball.speedX = parseInt(savedBallSpeed) || ball.speedX;
        ball.speedY = parseInt(savedBallSpeed) || ball.speedY;
    }
    if (savedPaddleLength) {
        paddleLengthSlider.value = savedPaddleLength;
        paddleLengthValue.innerText = savedPaddleLength;
        paddle1.height = parseInt(savedPaddleLength) || paddle1.height;
        paddle2.height = parseInt(savedPaddleLength) || paddle2.height;
    }
    if (savedPaddleSpeed) {
        paddleSpeedSlider.value = savedPaddleSpeed;
        paddleSpeedValue.innerText = savedPaddleSpeed;
        paddleSpeed = parseInt(savedPaddleSpeed) || paddleSpeed;
    }
}
function debugStorage() {
    console.log('localStorage content:');
    console.log('ballSpeed:', localStorage.getItem('ballSpeed'));
    console.log('paddleLength:', localStorage.getItem('paddleLength'));
    console.log('paddleSpeed:', localStorage.getItem('paddleSpeed'));
}
function saveSettings() {
    localStorage.setItem('ballSpeed', ballSpeedSlider.value);
    localStorage.setItem('paddleLength', paddleLengthSlider.value);
    localStorage.setItem('paddleSpeed', paddleSpeedSlider.value);
    debugStorage();
}
ballSpeedSlider.addEventListener('input', () => {
    ballSpeedValue.innerText = ballSpeedSlider.value;
    ball.speedX = parseInt(ballSpeedSlider.value);
    ball.speedY = parseInt(ballSpeedSlider.value);
    saveSettings();
});
paddleLengthSlider.addEventListener('input', () => {
    paddleLengthValue.innerText = paddleLengthSlider.value;
    const newHeight = parseInt(paddleLengthSlider.value);
    paddle1.updateHeight(newHeight);
    paddle2.updateHeight(newHeight);
    saveSettings();
});
paddleSpeedSlider.addEventListener('input', () => {
    paddleSpeedValue.innerText = paddleSpeedSlider.value;
    paddleSpeed = parseInt(paddleSpeedSlider.value);
    saveSettings();
});
window.addEventListener('keydown', (event) => {
    if (event.key === 'w') {
        controls.player1.up = true;
    }
    if (event.key === 's') {
        controls.player1.down = true;
    }
    if (event.key === 'ArrowUp') {
        controls.player2.up = true;
    }
    if (event.key === 'ArrowDown') {
        controls.player2.down = true;
    }
});
window.addEventListener('keyup', (event) => {
    if (event.key === 'w') {
        controls.player1.up = false;
    }
    if (event.key === 's') {
        controls.player1.down = false;
    }
    if (event.key === 'ArrowUp') {
        controls.player2.up = false;
    }
    if (event.key === 'ArrowDown') {
        controls.player2.down = false;
    }
});
window.addEventListener('keydown', (event) => {
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
// Constants for the maximum and minimum bounce angles
const MAX_ANGLE = Math.PI / 4;
const MIN_ANGLE = -Math.PI / 4;
// Function to handle ball bouncing off paddles
function handlePaddleCollision(ball, paddle) {
    const paddleCenter = paddle.y + paddle.height / 2;
    const hitPosition = (ball.y - paddleCenter) / (paddle.height / 2);
    // max bounce angle is 45 degrees
    const bounceAngle = hitPosition * MAX_ANGLE;
    // calculate new ball speed
    const speed = Math.sqrt(ball.speedX * ball.speedX + ball.speedY * ball.speedY);
    // flip the x speed and adjust the y speed based on the hit position
    ball.speedX = -Math.sign(ball.speedX) * speed * Math.cos(bounceAngle);
    ball.speedY = speed * Math.sin(bounceAngle);
    // apply minimum vertical speed safety check
    if (Math.abs(ball.speedY) < MIN_VERTICAL_SPEED) {
        ball.speedY = Math.sign(ball.speedY) * MIN_VERTICAL_SPEED;
    }
    // add some randomness to the bounce
    ball.speedY += (Math.random() - 0.5);
}
// Function to reset the ball position
function resetBall() {
    // Center the ball
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.speedX = 0;
    ball.speedY = 0;
    gameStarted = false;
}
// Function to serve the ball
function serveBall() {
    // 30% chance of a straight serve
    const isStraightServe = Math.random() < 0.3;
    const direction = servingPlayer === 1 ? 1 : -1;
    const speed = parseInt(ballSpeedSlider.value);
    if (isStraightServe) {
        ball.speedX = direction * speed;
        ball.speedY = 0;
    }
    else {
        const angle = (Math.random() - 0.5) * (MAX_ANGLE - MIN_ANGLE);
        ball.speedX = direction * speed * Math.cos(angle);
        ball.speedY = speed * Math.sin(angle);
    }
    gameStarted = true;
}
const BLINK_INTERVAL = 700;
let lastBlink = 0;
let showStartMessage = true;
// Function to draw the start message
function drawStartMessage(timestamp) {
    if (!gameStarted) {
        if (timestamp - lastBlink > BLINK_INTERVAL) {
            showStartMessage = !showStartMessage;
            lastBlink = timestamp;
        }
        if (showStartMessage) {
            context.fillStyle = "white";
            context.font = "20px Arial";
            context.textAlign = "center";
            context.fillText("Press Space to Start", canvas.width / 2, (canvas.height / 2) - 50);
        }
    }
}
// Basic game loop function
function gameLoop(timestamp) {
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
    }
    else if (ball.x > canvas.width) {
        scoreBoard.incrementPlayer1();
        const winner = scoreBoard.checkWinner();
        if (winner) {
            alert(`Game is over, ${winner} wins!`);
            scoreBoard.reset();
        }
        servingPlayer = 2;
        resetBall();
    }
    // Ball bouncing off top and bottom walls
    if (ball.y - ball.radius <= 0) {
        ball.y = ball.radius;
        ball.speedY = -ball.speedY;
        ball.speedY += (Math.random() - 0.5) * 2;
    }
    else if (ball.y + ball.radius >= canvas.height) {
        ball.y = canvas.height - ball.radius;
        ball.speedY = -ball.speedY;
        ball.speedY += (Math.random() - 0.5) * 2;
    }
    const minSpeed = Math.sign(ball.speedY) * MIN_VERTICAL_SPEED;
    ball.speedY = Math.sign(ball.speedY) * Math.max(Math.abs(ball.speedY), Math.abs(minSpeed));
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

export const PowerUpTypes = {
    PADDLE_GROW: 'paddle_grow',
    PADDLE_SHRINK: 'paddle_shrink',
    BALL_GROW: 'ball_grow',
    BALL_SHRINK: 'ball_shrink',
    PADDLE_SLOW: 'paddle_slow',
};
export const GameConfig = {
    LOBBY_TIMEOUT: 10 * 60 * 1000, // 30 minutes
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,
    WINNING_SCORE: 3,
    BASE_BALL_SPEED_FACTOR: 100,
    PADDLE_SPEED_FACTOR: 100,
    MIN_PADDLE_LENGTH: 50,
    BALL_SPEEDUP_FACTOR: 1.05,
    MAX_BALL_SPEED: 800,
    MIN_BALL_SPEED: 10,
    MAX_BALL_SIZE: 40,
    MIN_BALL_SIZE: 2,
    MIN_PADDLE_SPEED: 1,
    MIN_VERTICAL_SPEED: 2,
    MAX_ANGLE: Math.PI / 4,
    MIN_ANGLE: -Math.PI / 4,
    BLINK_INTERVAL: 700,
    DEFAULT_BALL_SPEED: 3,
    DEFAULT_BALL_RADIUS: 10,
    DEFAULT_PADDLE_LENGTH: 100,
    DEFAULT_PADDLE_WIDTH: 10,
    DEFAULT_PADDLE_SPEED: 1,
    DEFAULT_MAP: 'default',
    DEFAULT_POWERUPS: false,
    DEFAULT_MAX_SCORE: 3,
    TEST_MODE: true,
    TARGET_FPS: 20,
    BROADCAST_RATE: 20,
    PING_TIMEOUT: 5000, // 5 seconds
    PING_INTERVAL: 500, // 0.5 seconds
    POWERUP_DURATION: 10000, // 10 seconds
    POWERUP_SPAWN_CHANCE: 0.05,
    MAX_ACTIVE_POWERUPS: 2,
    POWERUP_SIZE: 50,
    POWERUP_VISUAL_SCALES: {
        [PowerUpTypes.PADDLE_GROW]: 0.005, // Mushroom
        [PowerUpTypes.PADDLE_SHRINK]: 0.00005, // Axe
        [PowerUpTypes.BALL_GROW]: 0.085, // Watermelon
        [PowerUpTypes.BALL_SHRINK]: 0.025, // Blueberry
        [PowerUpTypes.PADDLE_SLOW]: 0.015 // Turtle
    }
};
/*
🍄 Mushroom: Paddle Growth

🪓 Axe: Paddle Shrink

🍉 Watermelon: Ball Growth

🫐 Blueberry: Ball Shrink

🐢 Turtle: Paddle Slow */ 

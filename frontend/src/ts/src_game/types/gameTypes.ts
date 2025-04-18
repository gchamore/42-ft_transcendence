
export interface PaddleInput {
    inputSequence: number;
    paddlePosition: number;
}

export interface ServerPaddleState {
    x: number;
    y: number;
    width: number;
    height: number;
    speed: number;
    velocity: number;
    lastProcessedInput: number;
}
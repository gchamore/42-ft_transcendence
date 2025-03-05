
## Client to Server Messages

1. **`playerReady`**: Client signals player is ready to start
   ```javascript
   {
     type: "playerReady"
   }
   ```

2. **`startGameRequest`**: Player 1 requests to transition from lobby to game
   ```javascript
   {
     type: "startGameRequest",
     gameId: "uniqueGameId"
   }
   ```

3. **`startGame`**: Serving player requests to start/resume the game
   ```javascript
   {
     type: "startGame",
     playerNumber: 1|2
   }
   ```

4. **`movePaddle`**: Player moves their paddle
   ```javascript
   {
     type: "movePaddle",
     player: 1|2,
     y: 150 // Y position
   }
   ```

5. **`playerDisconnect`**: Player manually disconnects
   ```javascript
   {
     type: "playerDisconnect",
     player: 1|2,
     message: "Player X disconnected"
   }
   ```

6. **`updateSettings`**: Player 1 updates game settings
   ```javascript
   {
     type: "updateSettings",
     settings: {
       ballSpeed: 4,
       paddleSpeed: 4,
       paddleLength: 100,
       mapType: "default",
       powerUps: false
     }
   }
   ```

## Server to Client Messages

1. **`playerNumber`**: Assigns a player number to the client
   ```javascript
   {
     type: "playerNumber",
     playerNumber: 1|2
   }
   ```

2. **`connected`**: Welcome message when player joins
   ```javascript
   {
     type: "connected",
     message: "Welcome Player X!",
     gameId: "gameId"
   }
   ```

3. **`gameState`**: Current game state update
   ```javascript
   {
     type: "gameState",
     gameState: {
       gameId: "gameId",
       gameStarted: true|false,
       servingPlayer: 1|2,
       paddle1: { x: 10, y: 150, width: 10, height: 100, speed: 4 },
       paddle2: { x: 780, y: 150, width: 10, height: 100, speed: 4 },
       ball: { x: 400, y: 300, radius: 10, speedX: 4, speedY: 2 },
       score: { player1Score: 0, player2Score: 0 }
     },
     playerNumber: 1|2 // Only sent with initial gameState
   }
   ```

4. **`settingsUpdate`**: Game settings have been updated
   ```javascript
   {
     type: "settingsUpdate",
     settings: {
       ballSpeed: 4,
       paddleSpeed: 4,
       paddleLength: 100,
       mapType: "default",
       powerUps: false
     }
   }
   ```

5. **`player2Ready`**: Notifies player 1 that player 2 is ready
   ```javascript
   {
     type: "player2Ready"
   }
   ```

6. **`gameStart`**: Notifies players the game is starting
   ```javascript
   {
     type: "gameStart",
     gameId: "uniqueGameId",
     settings: { /* game settings */ }
   }
   ```

7. **`error`**: Error message from server
   ```javascript
   {
     type: "error",
     message: "Error message"
   }
   ```

8. **`gameOver`**: Game has ended
   ```javascript
   {
     type: "gameOver",
     reason: "Opponent disconnected"
   }
   ```

## Communication Flow

1. **Connection & Initialization**:
   - Client connects to `/game/{gameId}`
   - Server sends `playerNumber`, `connected`, initial `gameState`, and `settingsUpdate`

2. **Lobby & Setup**:
   - Clients send `playerReady`
   - Server notifies Player 1 with `player2Ready` when Player 2 is ready
   - Player 1 sends `startGameRequest`
   - Server responds with `gameStart` to both players

3. **Gameplay**:
   - Server sends periodic `gameState` updates (60fps when active, 1/5th that rate when idle)
   - Clients send `movePaddle` when moving
   - Serving player sends `startGame` to begin after scoring
   - Server broadcasts updated `gameState`

4. **Game End/Disconnect**:
   - Client sends `playerDisconnect` or connection closes
   - Server sends `gameOver` to remaining player

This message protocol enables the complete pong game functionality including lobby management, paddle movement, scoring, and game state synchronization.
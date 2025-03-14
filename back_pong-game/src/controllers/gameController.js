import { GameInstance } from "../classes/gameInstance.js";
import { handleNewPlayer } from '../handlers/messageHandlers.js';
import { safeSend } from '../utils/socketUtils.js';
import { TARGET_FPS, BROADCAST_RATE } from '../utils/config.js';

export const games = new Map();
export let mainLobby = null;
const broadcastTimeout = {};

export function setupWebSocketRoutes(fastify) {
	fastify.get('/game/status/:gameId', async (request, reply) => {
		const { gameId } = request.params;
		const gameExists = games.has(gameId);

		if (gameExists) {
			return { exists: true };
		}

		reply.code(404);
		return { exists: false };
	});

	 // WebSocket route
	 fastify.register(async function (fastify) {
		fastify.get('/game/:gameId', { websocket: true }, handleGameConnection);
	  });

	  // Start game update loop
	  setupGameUpdateInterval();
}

export function resetMainLobby() {
	mainLobby = new GameInstance('lobby-main', null, safeSend);
	return mainLobby;
}

function handleGameConnection(connection, request) {
	const socket = connection.socket;
	const { gameId } = request.params;

	console.log('WebSocket connection established for game:', { gameId });

	if (gameId === 'lobby-main') {
		if (!mainLobby) {
			mainLobby = new GameInstance(gameId, null, safeSend);
			console.log('Main lobby created');
		}
		handleNewPlayer(socket, mainLobby);
	} else {
		// Handle actual game connections
		let game = games.get(gameId);
		if (!game) {
			const lobbySettings = mainLobby ? mainLobby.settings : null;
			game = new GameInstance(gameId, lobbySettings, safeSend);
			games.set(gameId, game);
		}
		handleNewPlayer(socket, game);
	}
}

function setupGameUpdateInterval() {
	let lastUpdateTime = Date.now();
	setInterval(() => {
		const now = Date.now();
		const deltaTime = (now - lastUpdateTime) / 1000;
		lastUpdateTime = now;
		games.forEach((game) => {
			if (game.players.length === 0) return;

			processGameUpdate(game, deltaTime);

			if (!broadcastTimeout[game.gameId])
				broadcastTimeout[game.gameId] = 0;

			if (now - broadcastTimeout[game.gameId] >= 1000 / BROADCAST_RATE) {
				broadcastGameState(game);
				broadcastTimeout[game.gameId] = now;
			}
		});
	}, 1000 / TARGET_FPS);
}

function processGameUpdate(game, deltaTime) {
	if (game.players.length !== 2) return;

	const result = game.update(deltaTime);

	if (game.gameState.gameStarted && result.scored && result.winner) {
		game.players.forEach((player) => {
			safeSend(player, {
				type: 'gameOver',
				reason: 'scoreLimit',
				winner: result.winner,
				finalScore: {
					player1Score: game.gameState.score.player1Score,
					player2Score: game.gameState.score.player2Score,
				},
			});
		});
		game.gameState.gameStarted = false;
	}
}

export function broadcastGameState(game) {
	game.players.forEach((player) => {
		safeSend(player, {
			type: 'gameState',
			gameState: game.getState()
		});
	});
} 
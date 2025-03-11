import WebSocket from "ws";
import { GameInstance } from "../classes/gameInstance.js";
import { handleNewPlayer } from '../handlers/messageHandlers.js';
import { safeSend } from '../utils/socketUtils.js';
import { TARGET_FPS } from '../utils/config.js';

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
	setInterval(() => {
		const now = Date.now();
		games.forEach((game, gameId) => {
			if (gameId.startsWith('lobby-')) return;
			if (game.players.length > 0) {
				processGameUpdate(game);
				// Broadcast state less frequently than physics updates
				if (now - (broadcastTimeout[game.gameId] || 0) > 50) {
					broadcastGameState(game);
					broadcastTimeout[game.gameId] = now;
				}
			}
		});
	}, 1000 / TARGET_FPS);
}

function processGameUpdate(game) {
	if (!game.gameState.gameStarted || game.players.length !== 2) return;

	const result = game.update();

	if (result.scored && result.winner) {
		game.players.forEach((player) => {
			safeSend(player, {
				type: 'gameOver',
				reason: 'scoreLimit',
				winner: result.winner,
				score1: game.gameState.score.player1Score,
				score2: game.gameState.score.player2Score,
				message: `Player ${result.winner} wins!`
			});
		});
		game.gameState.gameStarted = false;
	}

	broadcastGameState(game);
}

export function broadcastGameState(game) {
	game.players.forEach((player) => {
		safeSend(player, {
			type: 'gameState',
			gameState: game.getState()
		});
	});
} 
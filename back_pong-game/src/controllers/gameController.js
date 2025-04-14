import { GameInstance } from "../classes/gameInstance.js";
import { LobbyManager } from "../classes/lobbyManager.js";
import { SettingsManager } from "../classes/settingsManager.js";
import { handleNewGamePlayer } from '../handlers/gameMessageHandlers.js';
import { handleNewLobbyPlayer } from '../handlers/lobbyMessageHandler.js';
import { safeSend } from '../utils/socketUtils.js';
import { GameConfig } from "../../public/dist/shared/config/gameConfig.js";

export const games = new Map();
export const settingsManagers = new Map();
export const lobbies = new Map();
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

function generateLobbyId() {
	return `lobby-${Math.random().toString(36).substring(2, 8)}`;
}

function getAvailableLobby() {
	for (const lobby of lobbies.values()) {
		if (lobby.players.size < 2) {
			return lobby;
		}
	}
	const newLobbyId = generateLobbyId();
	const newLobby = new LobbyManager(newLobbyId);
	lobbies.set(newLobbyId, newLobby);
	return newLobby;
}

export function resetlobbies() {
	lobbies.clear();
}

function handleGameConnection(connection, request) {
	const socket = connection.socket;
	const { gameId } = request.params;

	const clientId = request.query.clientId || `guest-${Math.random().toString(36).substring(2, 8)}`;

	console.log('WebSocket connection established for game:', { gameId });

	if (gameId.startsWith('lobby-')) {
		const lobby = getAvailableLobby();
		handleNewLobbyPlayer(socket, lobby, clientId);
	} else {
		// Handle actual game connections
		let game = games.get(gameId);
		let settingsManager = settingsManagers.get(gameId);
		if (!game) {
			if (!settingsManager) {
				settingsManager = new SettingsManager();
				settingsManagers.set(gameId, settingsManager);
			}

			const lobbySettings = settingsManager.getSettings();
			game = new GameInstance(gameId, lobbySettings, safeSend);
			games.set(gameId, game);
		}
		handleNewGamePlayer(socket, game);
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

			if (now - broadcastTimeout[game.gameId] >= 1000 / GameConfig.BROADCAST_RATE) {
				broadcastGameState(game);
				broadcastTimeout[game.gameId] = now;
			}
		});
	}, 1000 / GameConfig.TARGET_FPS);
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
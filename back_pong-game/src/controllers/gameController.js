import { GameInstance } from "../classes/gameInstance.js";
import { LobbyManager } from "../classes/lobbyManager.js";
import { SettingsManager } from "../classes/settingsManager.js";
import { handleNewGamePlayer } from '../handlers/gameMessageHandlers.js';
import { handleNewLobbyPlayer } from '../handlers/lobbyMessageHandler.js';
import { safeSend } from '../utils/socketUtils.js';
import { GameConfig } from "../../public/dist/shared/config/gameConfig.js";
import { handleDisconnect } from "../handlers/disconnectHandler.js";

export const games = new Map();
export const settingsManagers = new Map();
export const lobbies = new Map();
const broadcastTimeout = {};

export function setupWebSocketRoutes(fastify) {
	// REST endpoint to create a new game
	fastify.post('/game/create', async (request, reply) => {
		const gameId = Math.random().toString(36).substring(2, 8);
		const settingsManager = new SettingsManager();
		settingsManagers.set(gameId, settingsManager);

		reply.send({ gameId });
	});
	// WebSocket route
	fastify.register(async function (fastify) {
		fastify.get('/game/:gameId', { websocket: true }, handleGameConnection);
	});

	// Start game update loop
	setupGameUpdateInterval();
}

export function resetlobbies() {
	lobbies.clear();
}

function handleGameConnection(connection, request) {
	const socket = connection.socket;
	const { gameId } = request.params;
	const mode = request.query.mode;

	console.log('WebSocket connection established for game:', { gameId, mode });

	const clientId = request.query.clientId || Math.random().toString(36).substring(2, 8);

	if (mode === 'lobby') {
		let lobby;
		if (lobbies.has(gameId)) {
			lobby = lobbies.get(gameId);
		} else {
			lobby = new LobbyManager(gameId);
			lobbies.set(gameId, lobby);
		}
		handleNewLobbyPlayer(socket, lobby, clientId);
	} else if (mode === 'game') {
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
	} else {
		console.error('Invalid mode:', mode);
		socket.close();
		return;
	}
}

function setupGameUpdateInterval() {
	let lastUpdateTime = Date.now();
	setInterval(() => {
		const now = Date.now();
		const deltaTime = (now - lastUpdateTime) / 1000;
		lastUpdateTime = now;
		games.forEach((game) => {
			if (game.players.size === 0){
				games.delete(game.gameId);
				return;
			};

			processGameUpdate(game, deltaTime);

			if (!broadcastTimeout[game.gameId])
				broadcastTimeout[game.gameId] = 0;

			if (now - broadcastTimeout[game.gameId] >= 1000 / GameConfig.BROADCAST_RATE) {
				broadcastGameState(game);
				broadcastTimeout[game.gameId] = now;
				game.players.forEach((player) => {
					if (!player.isAlive) {
						console.log(`Player ${player.playerNumber} is unresponsive, disconnecting...`);
						handleDisconnect(player, game);
					} else {
						player.isAlive = false;
						safeSend(player, { type: 'ping' });
						console.log(`Ping sent to player ${player.playerNumber}`);
					}
				});
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
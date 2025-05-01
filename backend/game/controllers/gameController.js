import { GameInstance } from "../classes/gameInstance.js";
import { LobbyManager } from "../classes/lobbyManager.js";
import { handleNewGamePlayer } from '../handlers/gameMessageHandlers.js';
import { handleNewLobbyPlayer } from '../handlers/lobbyMessageHandler.js';
import { safeSend } from '../utils/socketUtils.js';
import { GameConfig } from "../shared/config/gameConfig.js";
import { handleDisconnect } from "../handlers/disconnectHandler.js";
import wsService from '../../ws/ws.service.js';
import { playerNumbers } from "../../routes/game.routes.js";

export const games = new Map();
export const lobbies = new Map();
const broadcastTimeout = {};

export function resetlobbies() {
	lobbies.clear();
}

export async function handleGameConnection(fastify, connection, request) {
	try {
		const socket = connection.socket;
		const { gameId } = request.params;
		const mode = request.query.mode;
		const userId = String(request.query?.userId || connection.socket.userId);

		// Log pour déboguer
		fastify.log.info(`WebSocket connection for gameId: ${gameId}, mode: ${mode}, userId: ${userId}`);

		// Gérer la logique du jeu en fonction du mode (lobby ou game)
		if (mode === 'lobby') {
			fastify.log.info(`User ${userId} is joining lobby mode for gameId: ${gameId}`);
			let lobby = lobbies.get(gameId) || new LobbyManager(gameId);
			lobbies.set(gameId, lobby);
			fastify.log.info(`socket = ${socket}, lobby = ${lobby}, userId = ${userId}, playerNumber = ${playerNumbers.get(userId)}`);
			handleNewLobbyPlayer(socket, lobby, userId, playerNumbers.get(userId), fastify);
		} else if (mode === 'game') {
			fastify.log.info(`User ${userId} is joining game mode for gameId: ${gameId}`);
			let game = games.get(gameId);
			let lobby = lobbies.get(gameId);

			if (!game) {
				if (!lobby) {
					console.error(`Lobby not found for gameId: ${gameId}`);
					socket.close(); // Fermer si aucun lobby trouvé
					return;
				}

				const lobbySettings = lobby.getSettings();
				game = new GameInstance(gameId, lobbySettings, safeSend);
				games.set(gameId, game);
			}

			handleNewGamePlayer(socket, game); // ← socket.userId est dispo ici
		} else {
			console.error('Invalid mode:', mode);
			socket.close();
		}
	} catch (error) {
		console.error('Error in handleGameConnection:', error);
		connection.socket.close();
	}
}



export function setupGameUpdateInterval() {
	let lastUpdateTime = Date.now();
	setInterval(() => {
		const now = Date.now();
		const deltaTime = (now - lastUpdateTime) / 1000;
		lastUpdateTime = now;
		games.forEach((game) => {
			if (game.players.size === 0) {
				games.delete(game.gameId);
				return;
			};

			processGameUpdate(game, deltaTime);

			if (!broadcastTimeout[game.gameId])
				broadcastTimeout[game.gameId] = 0;

			if (now - broadcastTimeout[game.gameId] >= 1000 / GameConfig.BROADCAST_RATE) {
				broadcastGameState(game);
				broadcastTimeout[game.gameId] = now;
				game.players.forEach((socket) => {
					if (!socket.isAlive) {
						if (socket.lastPingTime && now - socket.lastPingTime > GameConfig.PING_TIMEOUT) {
							console.log(`Player ${socket.playerNumber} is unresponsive, disconnecting...`);
							handleDisconnect(socket, game);
						}
					} else {
						socket.isAlive = false;
						socket.lastPingTime = now;
						safeSend(socket, { type: 'ping' });
					}
				});
			}
		});
	}, 1000 / GameConfig.TARGET_FPS);
}

function processGameUpdate(game, deltaTime) {
	if (game.players.size !== 2) return;

	const result = game.update(deltaTime);

	if (game.getState().gameStarted && result.scored && result.winner) {
		game.players.forEach((player) => {
			safeSend(player, {
				type: 'gameOver',
				reason: 'scoreLimit',
				winner: result.winner,
				finalScore: {
					player1Score: game.getState().score.player1Score,
					player2Score: game.getState().score.player2Score,
				},
			});
		});
		game.getState().gameStarted = false;
		return;
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
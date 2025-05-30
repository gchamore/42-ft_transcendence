import { GameInstance } from "../classes/gameInstance.js";
import { LobbyManager } from "../classes/lobbyManager.js";
import { handleNewGamePlayer } from '../handlers/gameMessageHandlers.js';
import { handleNewLobbyPlayer } from '../handlers/lobbyMessageHandler.js';
import { safeSend } from '../utils/socketUtils.js';
import { GameConfig } from "../shared/config/gameConfig.js";
import { handleDisconnect } from "../handlers/disconnectHandler.js";
import { gamePlayerNumbers, tournamentPlayerNumbers, settingsManagers, tournaments } from "../../routes/game.routes.js";



export const games = new Map();
export const lobbies = new Map();
const lastPingSent = {};
const broadcastTimeout = {};

export function resetlobbies() {
	lobbies.clear();
}

export async function handleGameConnection(fastify, connection, request, userId) {
	try {
		const socket = connection.socket;
		const { gameId } = request.params;
		const mode = request.query.mode;
		let isTournament = false;

		socket.isAlive = true;
		socket.clientId = userId;
		let playerNumber = null;
		const userIdStr = String(userId);
		// console.log(`gamePlayerNumbers:`, gamePlayerNumbers);
		if (gamePlayerNumbers.has(userIdStr)) {
			playerNumber = gamePlayerNumbers.get(userIdStr);
		} else if (tournamentPlayerNumbers.has(userIdStr)) {
			playerNumber = tournamentPlayerNumbers.get(userIdStr);
			isTournament = true;
		} else {
			console.error('User is not in any player number map:', userId);
		}
		// console.log('playerId:', userId, ' playerNumber:', playerNumber);

		if (mode === 'lobby') {
			let lobby = lobbies.get(gameId) || new LobbyManager(gameId, isTournament);
			lobbies.set(gameId, lobby);
			handleNewLobbyPlayer(socket, lobby, userId, playerNumber, fastify);
		} else if (isTournament && mode === 'game') {
			// Tournament: skip lobby, go straight to game
			let game = games.get(gameId);
			if (!game) {
				const settings = settingsManagers.get(gameId)?.getSettings() || {}; // or get from tournament object
				game = new GameInstance(gameId, settings, safeSend);
				games.set(gameId, game);
				cleanupLobby(gameId);
			}
			for (const tournament of tournaments.values()) {
				const match = tournament.bracket.find(match => match.matchId === gameId);
				if (match) {
					const playerObj = match.players.find(player => String(player.id) === String(userId));
					if (playerObj) {
						playerNumber = playerObj.number;
					}
				}
			}
			socket.playerNumber = playerNumber;
			handleNewGamePlayer(socket, game, fastify, isTournament);
			return;
		} else if (!isTournament && mode === 'game') {
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
				cleanupLobby(gameId);
			}
			socket.playerNumber = playerNumber;
			handleNewGamePlayer(socket, game, fastify, isTournament);
		} else {
			console.error('Invalid mode:', mode);
			socket.close();
		}
	} catch (error) {
		console.error('Error in handleGameConnection:', error);
		connection.socket.close();
	}
}

export function setupGameUpdateInterval(fastify) {
	let lastUpdateTime = Date.now();
	setInterval(() => {
		const now = Date.now();
		const deltaTime = (now - lastUpdateTime) / 1000;
		lastUpdateTime = now;
		games.forEach((game) => {
			if (game.players.size === 0) {
				cleanupGame(game.gameId);
				return;
			};

			processGameUpdate(game, deltaTime);

			if (!broadcastTimeout[game.gameId])
				broadcastTimeout[game.gameId] = 0;

			if (now - broadcastTimeout[game.gameId] >= 1000 / GameConfig.BROADCAST_RATE) {
				broadcastGameState(game);
				broadcastTimeout[game.gameId] = now;

				if (!lastPingSent[game.gameId])
					lastPingSent[game.gameId] = now;
				if (now - lastPingSent[game.gameId] >= GameConfig.PING_INTERVAL) {
					game.players.forEach((socket) => {
						if (!socket.isAlive) {
							if (socket.lastPingTime && now - socket.lastPingTime > GameConfig.PING_TIMEOUT) {
								console.log(`[PING] Player ${socket.playerNumber} (clientId: ${socket.clientId}) is unresponsive for ${now - socket.lastPingTime}ms, disconnecting from game ${game.gameId}...`);
								handleDisconnect(socket, game, fastify);
							} else {
								safeSend(socket, { type: 'ping' });
							}
						} else {
							socket.isAlive = false;
							socket.lastPingTime = now;
							safeSend(socket, { type: 'ping' });
						}
					});
					lastPingSent[game.gameId] = now;
				}
			}
		});
	}, 1000 / GameConfig.TARGET_FPS);
}

function processGameUpdate(game, deltaTime) {
	if (game.players.size !== 2) return;

	const result = game.update(deltaTime);

	if (game.getState().gameStarted && result.scored && result.winner) {
		game.players.forEach((player) => {
			const gameState = game.getState();
			const player1DisplayName = gameState.score.player1.name || "Player1";
			const player2DisplayName = gameState.score.player2.name || "Player2";
			const player1Score = gameState.score.player1.score;
			const player2Score = gameState.score.player2.score;
			safeSend(player, {
				type: 'gameOver',
				reason: 'scoreLimit',
				winner: result.winner,
				winnerDisplayName: result.winner === 1 ? player1DisplayName : player2DisplayName,
				finalScore: {
					player1: { name: player1DisplayName, score: player1Score },
					player2: { name: player2DisplayName, score: player2Score }
				},
			});
		});
		game.getState().gameStarted = false;
		broadcastGameState(game);
		game.broadcasting = false;
		return;
	}
}

export function broadcastGameState(game) {
	if (!game.broadcasting) return;
	game.players.forEach((player) => {
		safeSend(player, {
			type: 'gameState',
			gameState: game.getState()
		});
	});
}

function cleanupGame(gameId) {
	const game = games.get(gameId);
	if (game) {
		if (typeof game.cleanup === 'function') {
			// Await cleanup if it's async
			Promise.resolve(game.cleanup()).then(() => {
				games.delete(gameId);
			});
		} else {
			games.delete(gameId);
		}
	}
	if (settingsManagers.has(gameId)) {
		settingsManagers.delete(gameId);
	}
}

export function cleanupLobby(gameId) {
	const lobby = lobbies.get(gameId);
	if (lobby) {
		if (typeof lobby.cleanup === 'function') {
			lobby.cleanup(); // Custom cleanup logic for lobby
		}
		lobbies.delete(gameId);
	}
}

export function cleanupAllGamesAndLobbies() {
	// Clean up all games
	for (const gameId of games.keys()) {
		cleanupGame(gameId);
	}
	// Clean up all lobbies
	for (const lobbyId of lobbies.keys()) {
		cleanupLobby(lobbyId);
	}
}

import { GameInstance } from '../classes/gameInstance.js';
import { games } from '../controllers/gameController.js';
import { safeSend } from '../utils/socketUtils.js';
import { handleNewGamePlayer } from './gameMessageHandlers.js';
import { tournaments, gamePlayerNumbers, tournamentPlayerNumbers, tournamentQueue, tournamentDisplayNames } from '../../routes/game.routes.js';
import WebSocket from 'ws';

export function handleNewLobbyPlayer(socket, lobby, clientId, playerNumber, fastify) {
	// Verify socket is open
	if (socket.readyState !== WebSocket.OPEN) {
		console.error('Socket not in OPEN state');
		return;
	}
	socket.currentCloseHandler = (fastify) => handleLobbyDisconnect(socket, lobby, fastify);
	// Handle disconnect
	socket.on('close', (code, reason) => {
		if (socket.currentCloseHandler) {
			socket.currentCloseHandler(fastify);
			if (code !== 1000 && reason !== 'Starting tournament game') {
				const clientIdStr = String(socket.clientId);
				if (gamePlayerNumbers.has(clientIdStr)) {
					gamePlayerNumbers.delete(clientIdStr);
				}
				if (tournamentPlayerNumbers.has(clientIdStr)) {
					tournamentPlayerNumbers.delete(clientIdStr);
					console,log(`clientIdStr: ${clientIdStr} removed from tournamentPlayerNumbers`);
				}
				const tqIdx = tournamentQueue.indexOf(socket.clientId);
				if (tqIdx !== -1) {
					tournamentQueue.splice(tqIdx, 1);
				}
				tournamentDisplayNames.delete(socket.clientId);
			}
		} else {
			console.error('No close handler set for socket');
		}
	});
	
	if (!lobby.addPlayer(socket, clientId, playerNumber, fastify)) {
		fastify.log.error('Lobby is full');
		socket.close();
		return;
	}
	fastify.log.info(`Player ${playerNumber} joined lobby ${lobby.lobbyId}`);

	// Send welcome messages
	safeSend(socket, {
		type: 'playerNumber',
		playerNumber: playerNumber,
	});

	safeSend(socket, {
		type: 'connected',
		message: `Welcome Player ${playerNumber}!`,
		lobbyId: lobby.lobbyId,
	});

	// Player 1 sends settings to Player 2
	if (playerNumber !== 1) {
		safeSend(socket, {
			type: 'settingsUpdate',
			settings: lobby.getSettings(),
		});
	}

	socket.currentHandler = (data) => handleLobbyMessage(socket, lobby, data, fastify);

	// Set up socket message handler
	socket.on('message', (message) => {
		const data = JSON.parse(message);
		if (socket.currentHandler) {
			socket.currentHandler(data);
		} else {
			console.error('No handler set for incoming message');
		}
	});

}

function handleLobbyDisconnect(socket, lobby, fastify) {

	console.log(`Player ${socket.playerNumber} disconnected from lobby ${lobby.lobbyId}`);
	let message = `Player ${socket.playerNumber} disconnected`;
	if (lobby.isTournament) {
		message = `Player ${socket.playerNumber} disconnected, tournament has ended`;
	} else {
		message = `Player ${socket.playerNumber} disconnected, game has ended`;
	}
	if (!lobby.notified) {
		// Notify remaining players in the lobby
		lobby.players.forEach((playerSocket) => {
			safeSend(playerSocket, {
				type: 'opponentDisconnected',
				message: message
			});
		});
		lobby.notified = true;
	}
	lobby.removePlayer(socket.clientId);
	cleanUpSocketListeners(socket);
	const userConnections = fastify.connections.get(String(socket.clientId));
	if (userConnections)
		userConnections.delete(socket.connectionId);
}

function handleLobbyMessage(socket, lobby, data, fastify) {
	const playerNumber = socket.playerNumber;

	switch (data.type) {
		case 'updateSettings':
			if (playerNumber === 1) {
				lobby.updateSettings(data.settings);
			} else {
				safeSend(socket, {
					type: 'error',
					message: 'Only Player 1 can update settings',
				});
			}
			break;

		case 'playerReady':
			console.log(`Player ${playerNumber} is ready`);
			if (playerNumber !== 1) {
				const player1 = Array.from(lobby.players.values()).find((player) => player.playerNumber === 1);
				if (player1) {
					safeSend(player1, {
						type: 'playerReady',
						playerNumber: playerNumber,
					});
				}
			}
			break;
		case 'startGameRequest':
			if (playerNumber === 1) {
				const tournament = tournaments.get(Number(lobby.lobbyId));
				console.log(`Starting game from lobby ${lobby.lobbyId}`);
				startGameFromLobby(lobby, tournament, fastify);
			}
			break;

		default:
			console.error(`Unknown message in lobby type: ${data.type}`);
	}
}

function startGameFromLobby(lobby, tournament = null, fastify) {
	const gameId = lobby.lobbyId;
	const settings = lobby.getSettings();

	if (tournament)
		startTournamentGame(lobby, tournament, gameId, settings);
	else
		startNormalGame(lobby, gameId, settings);
}

function startNormalGame(lobby, gameId, settings, fastify) {
	const game = new GameInstance(gameId, settings);
	console.log(`Transitioning game from Lobby ${lobby.lobbyId} to ${gameId}`);

	games.set(gameId, game);

	// Notify players about the game start
	lobby.players.forEach((player) => {
		safeSend(player, {
			type: 'gameStart',
			gameId: gameId,
			settings: settings,
			playerNumber: player.playerNumber,
		});
		handleNewGamePlayer(player, game, fastify);
	});

	console.log(`Game successfully transitioned  to ${gameId}`);
}

function startTournamentGame(lobby, tournament, gameId, settings) {
	tournament.settings = settings;
	const matches = tournament.bracket
	
	matches.forEach(match => {
		const game = new GameInstance(match.matchId, settings);
		games.set(match.matchId, game);
		match.players.forEach(playerId => {
			const playerSocket = lobby.players.get(playerId.id);
			if (playerSocket) {
				playerSocket.playerNumber = playerId.number;
				safeSend(playerSocket, {
					type: 'TournamentGameStart',
					gameId: match.matchId,
					settings: settings,
					round: match.round,
					players: match.players.map(p => p.displayName),
					playerNumber: playerId.number,
				});
			}
		});
		console.log(`starting tournament game ${match.matchId} with players ${match.players}`);
	});
	return;
}

function cleanUpSocketListeners(socket) {
	try {
		const playerNum = socket.playerNumber;

		socket.removeAllListeners('message');
		socket.removeAllListeners('close');
		socket.removeAllListeners('error');

		socket.gameInstance = null;
		socket.isDisconnecting = true;
		socket.playerNumber = null;

		console.log(`Cleaned up listeners for player ${playerNum}`);
	} catch (e) {
		console.error('Error cleaning up socket listeners:', e);
	}
}

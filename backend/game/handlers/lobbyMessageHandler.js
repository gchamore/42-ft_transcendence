import { GameInstance } from '../classes/gameInstance.js';
import { games, lobbies, cleanupLobby } from '../controllers/gameController.js';
import { safeSend } from '../utils/socketUtils.js';
import { handleGameMessage, handleGameDisconnect } from './gameMessageHandlers.js';
import { handleNewGamePlayer } from './gameMessageHandlers.js';
import { tournaments } from '../../routes/game.routes.js';
import WebSocket from 'ws';

export function handleNewLobbyPlayer(socket, lobby, clientId, playerNumber, fastify) {
	// Verify socket is open
	if (socket.readyState !== WebSocket.OPEN) {
		console.error('Socket not in OPEN state');
		return;
	}
	socket.currentCloseHandler = () => handleLobbyDisconnect(socket, lobby);
	// Handle disconnect
	socket.on('close', () => {
		if (socket.currentCloseHandler) {
			socket.currentCloseHandler();
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

	socket.currentHandler = (data) => handleLobbyMessage(socket, lobby, data);

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

function handleLobbyDisconnect(socket, lobby) {

	console.log(`Player ${socket.playerNumber} disconnected from lobby ${lobby.lobbyId}`);
	lobby.removePlayer(socket);
	if (lobby.players.size === 0) {
		cleanupLobby(lobby.lobbyId);
		console.log(`Lobby ${lobby.lobbyId} deleted due to emptyness`);
	}
}

function handleLobbyMessage(socket, lobby, data) {
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
				const tournament = tournaments.get(lobby.lobbyId);
				console.log(`Starting game from lobby ${lobby.lobbyId}`);
				startGameFromLobby(lobby, tournament);
			}
			break;

		default:
			console.error(`Unknown message type: ${data.type}`);
	}
}

function startGameFromLobby(lobby, tournament = null) {
	const gameId = lobby.lobbyId;
	const settings = lobby.getSettings();

	if (tournament)
		startTournamentGame(lobby, tournament, gameId, settings);
	else
		startNormalGame(lobby, gameId, settings);
}

function startNormalGame(lobby, gameId, settings) {
	const game = new GameInstance(gameId, settings);
	console.log(`Transitioning game from Lobby ${lobby.lobbyId} to ${gameId}`);

	games.set(gameId, game);

	// Notify players about the game start
	lobby.players.forEach((player) => {
		safeSend(player, {
			type: 'gameStart',
			gameId: gameId,
			settings: settings,
		});
		player.currentHandler = (data) => handleGameMessage(player, game, data);
		player.currentCloseHandler = () => handleGameDisconnect(player, game);
		handleNewGamePlayer(player, game);
	});

	// Clean up the lobby
	lobby.players.clear();
	lobbies.delete(lobby.lobbyId);
	console.log(`Game successfully transitioned  to ${gameId}`);
}

function startTournamentGame(lobby, tournament, gameId, settings) {
	const bracket = tournament.bracket;
	const ready = tournament.ready || new Map();
	tournament.ready = ready;

	// Find the match for this lobby
	const match = bracket.find(m => m.matchId === gameId);
	if (!match) {
		console.error(`No match found for lobby ${gameId} in tournament ${tournament.id}`);
		return;
	}

	// Start the game as usual
	const game = new GameInstance(gameId, settings);
	games.set(gameId, game);

	lobby.players.forEach((player) => {
		safeSend(player, {
			type: 'gameStart',
			gameId: gameId,
			settings: settings,
			tournamentId: tournament.id,
			matchId: match.matchId,
			round: match.round,
		});
		player.currentHandler = (data) => handleGameMessage(player, game, data);
		player.currentCloseHandler = () => handleGameDisconnect(player, game);
		handleNewGamePlayer(player, game);
	});

	// Clean up the lobby
	lobby.players.clear();
	lobbies.delete(lobby.lobbyId);

	// Listen for game end to update bracket
	game.onEnd = (result) => {
		match.winner = result.winnerId;
		match.loser = result.loserId;
		ready.set(match.matchId, true);

		// If both semifinals are done, create finals and 3rd place
		const semisDone = bracket.filter(m => m.round === 'semifinal' && m.winner).length === 2;
		if (semisDone && !bracket.some(m => m.round === 'final')) {
			const [semi1, semi2] = bracket.filter(m => m.round === 'semifinal');
			const finalMatch = {
				matchId: `${tournament.id}-final`,
				round: 'final',
				players: [semi1.winner, semi2.winner],
				winner: null,
				loser: null,
			};
			const thirdMatch = {
				matchId: `${tournament.id}-third`,
				round: 'third',
				players: [semi1.loser, semi2.loser],
				winner: null,
				loser: null,
			};
			bracket.push(finalMatch, thirdMatch);

			// Create lobbies and start games for finals and 3rd place
			[finalMatch, thirdMatch].forEach(match => {
				const newLobby = createLobbyForMatch(match, settings); // You need to implement this
				lobbies.set(match.matchId, newLobby);
				startGameFromLobby(newLobby, tournament);
			});
		}

		// If finals and third are done, announce results
		const finalsDone = bracket.filter(m => ['final', 'third'].includes(m.round) && m.winner).length === 2;
		if (finalsDone) {
			const final = bracket.find(m => m.round === 'final');
			const third = bracket.find(m => m.round === 'third');
			// Announce tournament results
			tournament.players.forEach(pid => {
				const playerSocket = findPlayerSocket(pid); // You need to implement this
				if (playerSocket) {
					safeSend(playerSocket, {
						type: 'tournamentResults',
						placement: getTournamentPlacement(pid, final, third),
						finals: final,
						thirdPlace: third,
					});
				}
			});
		}
	};

	console.log(`Tournament match ${match.matchId} started for round ${match.round}`);
	return;
}
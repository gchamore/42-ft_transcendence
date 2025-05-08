import { SettingsManager } from '../game/classes/settingsManager.js';
import { setupGameUpdateInterval, handleGameConnection } from '../game/controllers/gameController.js';
import { safeSend } from '../game/utils/socketUtils.js';
import wsService from '../ws/ws.service.js';

export const settingsManagers = new Map();
export const gamePlayerNumbers = new Map();
export const tournamentPlayerNumbers = new Map();
export const tournamentDisplayNames = new Map();
export const tournaments = new Map();
const gameQueue = [];
let tournamentId = 1;
const tournamentQueue = [];
const invites = [];

function notifyPlayers(fastify, gameId, playerId) {
	const connections = fastify.connections.get(playerId);

	if (connections) {
		for (const [, socket] of connections.entries()) {
			if (socket.readyState === 1) {
				socket.send(JSON.stringify({
					type: 'matchFound',
					gameId,
				}));
				break;
			}
		}
	} else {
		console.warn(`No WebSocket connection found for player ${playerId}`);
	}
}


export async function gameRoutes(fastify, options) {
	const { db } = fastify;

	// 1v1
	fastify.post('/game/queue', async (request, reply) => {
		const { userId } = request.body;

		if (!userId) {
			return reply.code(401).send({ error: 'Unauthorized' });
		}

		if (tournamentQueue.includes(userId)) {
			return reply.code(400).send({ error: 'Cannot join game queue while in tournament queue' });
		}

		if (gameQueue.includes(userId)) {
			return reply.code(400).send({ error: 'Already in queue' });
		}

		gameQueue.push(userId);
	
		if (gameQueue.length >= 2) {
			const [p1, p2] = gameQueue.splice(0, 2);
	
			const gameId = Math.random().toString(36).substring(2, 8);
			settingsManagers.set(gameId, new SettingsManager());
		
			gamePlayerNumbers.set(String(p1), 1);
			console.log('Player 1:', p1);
			gamePlayerNumbers.set(String(p2), 2);
			console.log('Player 2:', p2);
			notifyPlayers(fastify, gameId, p1);
			notifyPlayers(fastify, gameId, p2);
			
			return reply.send({ matched: true});
		}
		return reply.code(202).send({ queued: true });
	});

	fastify.delete('/game/queue/leave', async (request, reply) => {
		const userId = request.user?.userId;

		if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

		const index = gameQueue.indexOf(userId);
		if (index !== -1) {
			gameQueue.splice(index, 1);
			return reply.send({ left: true });
		}
		return reply.code(200).send({ notInQueue: true });

	});

	// —— TOURNAMENT ——
	fastify.post('/tournament/queue', async (request, reply) => {
		const { userId, displayName } = request.body;
		if (!userId || !displayName) {
			return reply.code(401).send({ error: 'Unauthorized' });
		}

		const lowerDisplayName = displayName.trim().toLowerCase();
		for (const name of tournamentDisplayNames.values()) {
			if (name.toLowerCase() === lowerDisplayName) {
				return reply.code(409).send({ error: 'Display name already taken' });
			}
		}

		if (gameQueue.includes(userId)) {
			return reply.code(400).send({ error: 'Cannot join tournament queue while in game queue' });
		}

		if (tournamentQueue.includes(userId)) {
			return reply.code(400).send({ error: 'Already in tournament queue' });
		}
		tournamentQueue.push(userId);
		tournamentDisplayNames.set(userId, displayName);
	
		// If 4 players, create tournament
		if (tournamentQueue.length >= 4) {
			const players = tournamentQueue.splice(0, 4);
			const displayNames = players.map(pid => tournamentDisplayNames.get(pid));
			const tid = tournamentId++;
			tournaments.set(tid, {
				id: tid,
				maxPlayers: 4,
				players: players.slice(),
				displayNames: displayNames.slice(),
				bracket: [],
			});
			players.forEach((pid, idx) => {
				tournamentPlayerNumbers.set(String(pid), idx + 1);
				tournamentDisplayNames.delete(pid);
				console.log('Tournament Player:', pid, 'Number:', idx + 1);
			});
			// Randomize player order
			const shuffled = players.slice().sort(() => Math.random() - 0.5);
			const matches = [
				{
					matchId: `${tid}-semi1`, round: 'semifinal', players: [
						{ id: shuffled[0], number: 1, displayName: displayNames[players.indexOf(shuffled[0])] },
						{ id: shuffled[1], number: 2, displayName: displayNames[players.indexOf(shuffled[1])] }], winner: null, loser: null
				},
				{
					matchId: `${tid}-semi2`, round: 'semifinal', players: [
						{ id: shuffled[2], number: 1, displayName: displayNames[players.indexOf(shuffled[2])] },
						{ id: shuffled[3], number: 2, displayName: displayNames[players.indexOf(shuffled[3])] }], winner: null, loser: null
				},
			];
			tournaments.get(tid).bracket = matches;
			tournaments.get(tid).ready = new Map();
			const playerList = displayNames.join(', ');
			// Notify all players 
			players.forEach(pid => {
				const userConnections = fastify.connections.get(pid);
				if (userConnections) {
					for (const [, socket] of userConnections.entries()) {
						safeSend(socket, {
							type: 'tournamentStart',
							tournamentId: tid,
							bracket: matches,
						});
						safeSend(socket, {
							type: 'livechat',
							message: `Tournament ${tid} started! Players: ${playerList}`,
							user: `TournamentSystem`,
						})
						break;
					}
				}
			});
			return reply.send({ matched: true, tournamentId: tid, isCreator: players[0] === userId });
		}
		return reply.code(202).send({ queued: true, joinedCount: tournamentQueue.length, needed: 4 - tournamentQueue.length, isCreator: false });
	});

	// Tournament queue: leave
	fastify.delete('/tournament/queue/leave', async (request, reply) => {
		const userId = request.user?.userId;
		if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
		const index = tournamentQueue.indexOf(userId);
		if (index !== -1) {
			tournamentQueue.splice(index, 1);
			return reply.send({ left: true });
		}
		return reply.code(200).send({ notInQueue: true });
	});

	// —— INVITES ——
	fastify.post('/invites', async (request, reply) => {
		const userId = request.user?.userId;
		const { toUsername, gameType, tournamentId } = request.body;

		if (!userId || !toUsername || !gameType) {
			return reply.code(400).send({ error: 'Missing fields' });
		}

		invites.push({ fromId: userId, toUsername, gameType, tournamentId });
		return reply.send({ invited: true });

	});


	// WebSocket route
	fastify.get('/game/:gameId', { websocket: true }, async (connection, request) => {
		try {
			fastify.log.info('Starting WebSocket connection setup...');
			
			const accessToken = request.cookies?.accessToken;
			const refreshToken = request.cookies?.refreshToken;
	
			if (!accessToken && !refreshToken) {
				console.warn('No access and refresh token provided');
				return;
			}
	
			const validation = await wsService.validateConnectionToken(fastify, connection, accessToken, refreshToken, fastify.db);
			if (!validation) {
				console.warn('Invalid access token');
				return;
			}
			
			fastify.log.info('Token validated, fetching user info...');
			const userId = validation.userId;

			// Récupère l'userId depuis la query params
			if (!userId) {
				fastify.log.warn('No userId provided in query');
				return;
			}
			fastify.log.info(`User ID from query: ${userId}`);
			
			const user = fastify.db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
			if (!user) {
				console.warn('User not found');
				return;
			}

			const displayName = tournamentDisplayNames.get(userId);
			connection.socket.displayName = displayName;
	
			// Vérifie si l'utilisateur a déjà une connexion active
			const existingConnections = fastify.connections.get(userId);
			if (!existingConnections) {
				fastify.log.warn(`User ${userId} does not have any active connections`);
				return;
			}
	
			// Ajouter la nouvelle connexion à la map de l'utilisateur
			const connectionId = wsService.generateConnectionId();
			fastify.log.info(`Generated connection ID: ${connectionId}`);
	
			// Ajoute cette nouvelle connexion à la map des connexions de l'utilisateur
			existingConnections.set(connectionId, connection.socket);
			fastify.log.info(`New WebSocket connection [ID: ${connectionId}] for user: ${userId}`);
				
			// Appel de la fonction handleGameConnection pour gérer la logique de jeu spécifique
			await handleGameConnection(fastify, connection, request, userId);

		} catch (error) {
			fastify.log.error('Error setting up WebSocket connection:', error);
		}
	});
	
	
	// Start game update loop
	setupGameUpdateInterval(fastify);
}

// connection.socket.on('close', () => {
// 	const idxG = gameQueue.indexOf(userId);
// 	if (idxG  !== -1) {
// 		gameQueue.splice(idxG , 1);
// 	}
// 	const idxT = tournamentQueue.indexOf(userId);
// 	if (idxT !== -1) {
// 		queue.splice(idxT, 1);
// 	}
// 	fastify.connections.delete(userId);
// });
import { SettingsManager } from '../game/classes/settingsManager.js';
import { setupGameUpdateInterval, handleGameConnection } from '../game/controllers/gameController.js';

export const settingsManagers = new Map();
export const playerNumbers = new Map();
const gameQueue = [];
let tournamentId = 0;
const tournaments = new Map();
const tournamentQueue = [];
const invites = [];

function notifyPlayers(fastify, gameId, playerId) {
	const socket = fastify.connections.get(playerId);
	if (socket) {
		socket.send(JSON.stringify({
			type: 'matchFound',
			gameId,
		}));
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
	
		if (gameQueue.includes(userId)) {
			return reply.code(400).send({ error: 'Already in queue' });
		}
	
		gameQueue.push(userId);
	
		if (gameQueue.length >= 2) {
			const [p1, p2] = gameQueue.splice(0, 2);
	
			const gameId = Math.random().toString(36).substring(2, 8);
			settingsManagers.set(gameId, new SettingsManager());
		
			playerNumbers.set(String(p1), 1);
			console.log('Player 1:', p1);
			playerNumbers.set(String(p2), 2);
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
		const userId = request.user?.userId;
		if (!userId) {
			return reply.code(401).send({ error: 'Unauthorized' });
		}
		if (tournamentQueue.includes(userId)) {
			return reply.code(400).send({ error: 'Already in tournament queue' });
		}
		tournamentQueue.push(userId);
	
		// If 4 players, create tournament
		if (tournamentQueue.length >= 4) {
			const players = tournamentQueue.splice(0, 4);
			const tid = tournamentId++;
			tournaments.set(tid, {
				id: tid,
				creatorId: players[0],
				maxPlayers: 4,
				players: players.slice(),
				bracket: [],
				status: 'started',
				ready: new Map()
			});
			// Randomize player order
			const shuffled = players.slice().sort(() => Math.random() - 0.5);
			const matches = [
				{ matchId: `${tid}-semi1`, round: 'semifinal', players: [shuffled[0], shuffled[1]], winner: null, loser: null },
				{ matchId: `${tid}-semi2`, round: 'semifinal', players: [shuffled[2], shuffled[3]], winner: null, loser: null }
			];
			tournaments.get(tid).bracket = matches;
			tournaments.get(tid).ready = new Map();
	
			// Notify all players (WebSocket or HTTP response)
			players.forEach(pid => {
				const socket = fastify.connections.get(pid);
				if (socket) {
					socket.send(JSON.stringify({
						type: 'tournamentStart',
						tournamentId: tid,
						bracket: matches,
					}));
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
	fastify.register(async function (fastify) {
		fastify.get('/game/:gameId', { websocket: true }, (connection, request) =>{
			const userId = request.query?.userId;
			if (userId) {
				fastify.connections.set(userId, connection.socket);
				connection.socket.on('close', () => {
					const idx = gameQueue.indexOf(userId);
					if (idx !== -1) {
						gameQueue.splice(idx, 1);
					}
					fastify.connections.delete(userId);
				});
			}
			handleGameConnection(fastify, connection, request)
		});

		// New: Tournament match notification route
		fastify.get('/tournament/:tournamentId/notify', { websocket: true }, (connection, request) => {
			const userId = request.query?.userId;
			const tid = Number(request.params.tournamentId);
			if (userId) {
				fastify.connections.set(userId, connection.socket);
				connection.socket.on('close', () => {
					let queue = tournamentQueues.get(tid) || []; //need to modify to array
					const idx = queue.indexOf(userId);
					if (idx !== -1) {
						queue.splice(idx, 1);
						tournamentQueues.set(tid, queue); //need to modify to array
					}
					fastify.connections.delete(userId);
				});
			}
		});
	});
	
	// Start game update loop
	setupGameUpdateInterval();
}


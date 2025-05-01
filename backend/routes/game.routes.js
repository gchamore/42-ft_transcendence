import { SettingsManager } from '../game/classes/settingsManager.js';
import { setupGameUpdateInterval, handleGameConnection } from '../game/controllers/gameController.js';
import wsService from '../ws/ws.service.js';

export const settingsManagers = new Map();
export const playerNumbers = new Map();
const gameQueue = [];
let tournamentId = 0;
const tournaments = new Map();
const tournamentQueues = new Map();
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

	// create a new game
	fastify.post('/game/create', async (request, reply) => {
		const gameId = Math.random().toString(36).substring(2, 8);
		const settingsManager = new SettingsManager();
		settingsManagers.set(gameId, settingsManager);

		reply.send({ gameId });
	});

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
	fastify.post('/tournaments', async (request, reply) => {
		const userId = request.user?.userId;
		const { maxPlayers } = request.body;

		if (!userId || !maxPlayers) {
			return reply.code(400).send({ error: 'maxPlayers is required' });
		}

		const tid = tournamentId++;
		tournaments.set(tid, {
			id: tid,
			creatorId: userId,
			maxPlayers,
			players: [],
			bracket: [],
			status: 'waiting'
		});

		return reply.code(201).send({ tournamentId: tid });
	});

	fastify.post('/tournaments/:tournamentId/join', async (request, reply) => {
		const tid = Number(request.params.tournamentId);
		const userId = request.user?.userId;
		const tour = tournaments.get(tid);
		if (!tour) {
			return reply.code(404).send({ error: 'Tournament not found' });
		}

		// pull or init queue
		let queue = tournamentQueues.get(tid) || [];
		if (queue.includes(userId)) {
			return reply.code(400).send({ error: 'Already joined' });
		}
		queue.push(userId);
		tournamentQueues.set(tid, queue);

		// not full yet?
		if (queue.length < tour.maxPlayers) {
			return reply.code(202).send({
				queued: true,
				joinedCount: queue.length,
				needed: tour.maxPlayers - queue.length
			});
		}

		// full → start tournament
		tour.players = queue.slice();
		tour.status = 'started';

		// simple single‑elim bracket pairing
		const matches = [];
		for (let i = 0; i < queue.length; i += 2) {
			matches.push({
				matchId: `${tid}-${i / 2}`,
				players: [queue[i], queue[i + 1]],
				winner: null
			});
		}
		tour.bracket = matches;

		return reply.send({
			tournamentId: tid,
			bracket: matches,
			status: tour.status
		});
	});

	fastify.get('/tournaments/:tournamentId', async (request, reply) => {
		const tid = Number(request.params.tournamentId);
		const tour = tournaments.get(tid);
		if (!tour) {
			return reply.code(404).send({ error: 'Tournament not found' });
		}
		return reply.send({
			players: tour.players,
			bracket: tour.bracket,
			status: tour.status
		});
	});

	fastify.get('/tournaments/:tournamentId/bracket', async (request, reply) => {
		const tid = Number(request.params.tournamentId);
		const tour = tournaments.get(tid);
		if (!tour) {
			return reply.code(404).send({ error: 'Tournament not found' });
		}
		return reply.send({ matches: tour.bracket });
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
			await handleGameConnection(fastify, connection, request);

		} catch (error) {
			fastify.log.error('Error setting up WebSocket connection:', error);
		}
	});
	
	
	// Start game update loop
	setupGameUpdateInterval();
}


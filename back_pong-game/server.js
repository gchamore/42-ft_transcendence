import Fastify from 'fastify';
import fastifyWebSocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import { join } from 'path';
import { setupWebSocketRoutes } from './src/controllers/gameController.js';

const fastify = Fastify({ logger: true });

// Register CORS plugin
fastify.register(fastifyCors, {
	origin: '*', // Allow all origins
});

// Register fastify websocket plugin
fastify.register(fastifyWebSocket);

// Register fastify static plugin to serve static files
fastify.register(fastifyStatic, {
	root: join(process.cwd(), 'public'),
	prefix: '/',
	list: true,
	index: 'index.html'
});

setupWebSocketRoutes(fastify);

fastify.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
	if (err) {
		console.error(err);
		process.exit(1);
	}
	console.log(`Server is running at ${address}`);
});
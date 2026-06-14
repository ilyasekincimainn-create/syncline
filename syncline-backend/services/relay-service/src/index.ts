import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { initSignalingServer } from './signaling/server';
import * as dotenv from 'dotenv';

dotenv.config();

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

async function main() {
  try {
    await fastify.register(cors, {
      origin: true,
      credentials: true,
    });

    await fastify.register(websocket, {
      options: {
        maxPayload: 1048576, // 1MB
      }
    });

    fastify.ready((err: Error | null) => {
      if (err) throw err;
      
      const wss = fastify.websocketServer;
      if (!wss) {
        throw new Error('WebSocket server was not initialized');
      }
      initSignalingServer(wss);
      console.log('Relay Signaling WebSocket server initialized successfully.');
    });

    fastify.get('/health', async () => {
      return { status: 'healthy', service: 'relay-service', timestamp: new Date().toISOString() };
    });

    const port = parseInt(process.env.PORT || '3004', 10);
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    console.log(`Relay Service is running on http://${host}:${port}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

main();


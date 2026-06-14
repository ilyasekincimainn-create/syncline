import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { initWebSocketServer } from './websocket/server';
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

    // Register @fastify/websocket
    await fastify.register(websocket, {
      options: {
        maxPayload: 1048576, // 1MB
      }
    });

    // Define websocket route
    fastify.get('/ws', { websocket: true }, () => {
      // Pass the WebSocket server instance to server handler
      // @fastify/websocket passes connection.socket
    });

    // Initialize custom wss logic by hooking to fastify's server
    fastify.ready((err: Error | null) => {
      if (err) throw err;
      
      const wss = fastify.websocketServer;
      if (!wss) {
        throw new Error('WebSocket server was not initialized');
      }
      initWebSocketServer(wss);
      console.log('Sync WebSocket server initialized successfully.');
    });

    fastify.get('/health', async () => {
      return { status: 'healthy', service: 'sync-service', timestamp: new Date().toISOString() };
    });

    const port = parseInt(process.env.PORT || '3002', 10);
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    console.log(`Sync Service is running on http://${host}:${port}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

main();


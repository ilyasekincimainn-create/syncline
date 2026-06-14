import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { authRoutes } from './routes/auth';
import { initWebSocketServer } from './websocket/server';
import * as dotenv from 'dotenv';

dotenv.config();

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
      level: (label) => {
        return { level: label.toUpperCase() };
      },
    },
  },
});

async function main() {
  try {
    // Register CORS
    await fastify.register(cors, {
      origin: true,
      credentials: true,
    });

    // Register rate limit
    await fastify.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute',
    });

    // Register @fastify/websocket
    await fastify.register(websocket, {
      options: {
        maxPayload: 1048576, // 1MB
      }
    });

    // Define websocket route
    fastify.get('/ws', { websocket: true }, () => {
      // Handled by initWebSocketServer through fastify.websocketServer
    });

    // Initialize custom wss logic by hooking to fastify's server
    fastify.ready((err: Error | null) => {
      if (err) throw err;
      
      const wss = fastify.websocketServer;
      if (!wss) {
        throw new Error('WebSocket server was not initialized');
      }
      initWebSocketServer(wss);
      console.log('Sync WebSocket server integrated and initialized successfully.');
    });

    // Register routes
    await fastify.register(authRoutes, { prefix: '/api/auth' });

    // Health check
    fastify.get('/health', async () => {
      return { status: 'healthy', service: 'auth-sync-combined-service', timestamp: new Date().toISOString() };
    });

    const port = parseInt(process.env.PORT || '3001', 10);
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    console.log(`Combined Auth & Sync Service is running on http://${host}:${port}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

main();

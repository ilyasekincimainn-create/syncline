import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { authRoutes } from './routes/auth';
import { handleWebSocketConnection, initRedisSubscription } from './websocket/server';
import { connectRedis } from './services/redis';
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

    // Register @fastify/websocket plugin
    await fastify.register(websocket, {
      options: {
        maxPayload: 1048576, // 1MB
      }
    });

    // WebSocket route - each connection handled by handleWebSocketConnection
    fastify.get('/ws', { websocket: true }, (connection /* SocketStream */, req) => {
      console.log(`[WS] New WebSocket connection from ${req.ip}`);
      handleWebSocketConnection(connection.socket, req);
    });

    // Register auth routes
    await fastify.register(authRoutes, { prefix: '/api/auth' });

    // Health check - also lists registered routes for debugging
    fastify.get('/health', async () => {
      return {
        status: 'healthy',
        service: 'auth-sync-combined-service',
        timestamp: new Date().toISOString(),
        wsEndpoint: '/ws',
      };
    });

    // Wait for all plugins and routes to be registered
    await fastify.ready();

    // Log all registered routes for debugging
    const routes = fastify.printRoutes();
    console.log('=== Registered Routes ===');
    console.log(routes);
    console.log('=========================');

    // Connect Redis gracefully (non-blocking)
    await connectRedis();

    // Setup Redis pub/sub for cross-node messaging
    initRedisSubscription();

    console.log('Sync WebSocket server integrated and initialized successfully.');

    const port = parseInt(process.env.PORT || '3001', 10);
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    console.log(`Combined Auth & Sync Service is running on http://${host}:${port}`);
    console.log(`WebSocket endpoint available at ws://${host}:${port}/ws`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

main();

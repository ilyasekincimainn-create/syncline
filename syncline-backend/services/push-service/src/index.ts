import Fastify from 'fastify';
import cors from '@fastify/cors';
import { initApns } from './providers/apns';
import { initFcm } from './providers/fcm';
import { startPushConsumer, stopPushConsumer } from './consumers/redis';
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

    // Initialize push notification providers
    initApns();
    initFcm();

    // Start consuming background streams
    await startPushConsumer();

    fastify.get('/health', async () => {
      return { status: 'healthy', service: 'push-service', timestamp: new Date().toISOString() };
    });

    const port = parseInt(process.env.PORT || '3003', 10);
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    console.log(`Push Service is running on http://${host}:${port}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  stopPushConsumer();
  process.exit(0);
});

main();

import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { authRoutes } from './routes/auth';
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

    // Register routes
    await fastify.register(authRoutes, { prefix: '/api/auth' });

    // Health check
    fastify.get('/health', async () => {
      return { status: 'healthy', service: 'auth-service', timestamp: new Date().toISOString() };
    });

    const port = parseInt(process.env.PORT || '3001', 10);
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    console.log(`Auth Service is running on http://${host}:${port}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

main();

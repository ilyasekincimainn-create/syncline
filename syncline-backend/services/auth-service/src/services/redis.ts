import Redis from 'ioredis';
import * as dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

console.log('Connecting to Redis at:', redisUrl);

// Configure Redis with retry strategy that doesn't crash the process
const redisOptions = {
  maxRetriesPerRequest: null as null,
  retryStrategy: (times: number) => {
    if (times > 10) {
      console.warn('Redis: Max retry attempts reached, will retry in 30s');
      return 30000; // retry every 30s after 10 attempts
    }
    return Math.min(times * 500, 5000); // exponential backoff up to 5s
  },
  lazyConnect: true, // Don't connect immediately on creation
  enableOfflineQueue: false, // Don't queue commands when offline
};

export const redisPub = new Redis(redisUrl, redisOptions);
export const redisSub = new Redis(redisUrl, redisOptions);

let redisConnected = false;

redisPub.on('error', (err) => {
  if (redisConnected) {
    console.error('Redis Publisher Error:', err.message);
  }
  redisConnected = false;
});

redisSub.on('error', (err) => {
  if (redisConnected) {
    console.error('Redis Subscriber Error:', err.message);
  }
  redisConnected = false;
});

redisPub.on('connect', () => {
  redisConnected = true;
  console.log('Redis Publisher connected');
});

redisSub.on('connect', () => {
  console.log('Redis Subscriber connected');
});

export function isRedisConnected(): boolean {
  return redisConnected;
}

// Gracefully connect - don't throw if Redis is unavailable
export async function connectRedis(): Promise<void> {
  try {
    await Promise.all([
      redisPub.connect(),
      redisSub.connect(),
    ]);
    console.log('Redis connected successfully');
  } catch (err: any) {
    console.warn('Redis connection failed (will retry in background):', err.message);
    // Don't throw - let the server start without Redis
  }
}

export async function publishToStream(streamName: string, eventData: Record<string, string>) {
  if (!redisConnected) {
    console.warn(`Redis not connected, skipping publish to ${streamName}`);
    return;
  }
  try {
    await redisPub.xadd(streamName, '*', ...Object.entries(eventData).flat());
  } catch (error: any) {
    console.error(`Failed to publish to Redis stream ${streamName}:`, error.message);
    // Don't throw - graceful degradation
  }
}

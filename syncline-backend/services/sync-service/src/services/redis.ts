import Redis from 'ioredis';
import * as dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

console.log('Connecting to Redis at:', redisUrl);

export const redisPub = new Redis(redisUrl);
export const redisSub = new Redis(redisUrl);

redisPub.on('error', (err) => console.error('Redis Publisher Error:', err));
redisSub.on('error', (err) => console.error('Redis Subscriber Error:', err));

export async function publishToStream(streamName: string, eventData: Record<string, string>) {
  try {
    // Add to stream with automatic ID generation '*'
    await redisPub.xadd(streamName, '*', ...Object.entries(eventData).flat());
  } catch (error) {
    console.error(`Failed to publish to Redis stream ${streamName}:`, error);
    throw error;
  }
}

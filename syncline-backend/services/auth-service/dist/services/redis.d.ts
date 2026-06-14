import Redis from 'ioredis';
export declare const redisPub: Redis;
export declare const redisSub: Redis;
export declare function publishToStream(streamName: string, eventData: Record<string, string>): Promise<void>;
//# sourceMappingURL=redis.d.ts.map
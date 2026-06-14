"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisSub = exports.redisPub = void 0;
exports.isRedisConnected = isRedisConnected;
exports.connectRedis = connectRedis;
exports.publishToStream = publishToStream;
const ioredis_1 = __importDefault(require("ioredis"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
console.log('Connecting to Redis at:', redisUrl);
// Configure Redis with retry strategy that doesn't crash the process
const redisOptions = {
    maxRetriesPerRequest: null,
    retryStrategy: (times) => {
        if (times > 10) {
            console.warn('Redis: Max retry attempts reached, will retry in 30s');
            return 30000; // retry every 30s after 10 attempts
        }
        return Math.min(times * 500, 5000); // exponential backoff up to 5s
    },
    lazyConnect: true, // Don't connect immediately on creation
    enableOfflineQueue: false, // Don't queue commands when offline
};
exports.redisPub = new ioredis_1.default(redisUrl, redisOptions);
exports.redisSub = new ioredis_1.default(redisUrl, redisOptions);
let redisConnected = false;
exports.redisPub.on('error', (err) => {
    if (redisConnected) {
        console.error('Redis Publisher Error:', err.message);
    }
    redisConnected = false;
});
exports.redisSub.on('error', (err) => {
    if (redisConnected) {
        console.error('Redis Subscriber Error:', err.message);
    }
    redisConnected = false;
});
exports.redisPub.on('connect', () => {
    redisConnected = true;
    console.log('Redis Publisher connected');
});
exports.redisSub.on('connect', () => {
    console.log('Redis Subscriber connected');
});
function isRedisConnected() {
    return redisConnected;
}
// Gracefully connect - don't throw if Redis is unavailable
async function connectRedis() {
    try {
        await Promise.all([
            exports.redisPub.connect(),
            exports.redisSub.connect(),
        ]);
        console.log('Redis connected successfully');
    }
    catch (err) {
        console.warn('Redis connection failed (will retry in background):', err.message);
        // Don't throw - let the server start without Redis
    }
}
async function publishToStream(streamName, eventData) {
    if (!redisConnected) {
        console.warn(`Redis not connected, skipping publish to ${streamName}`);
        return;
    }
    try {
        await exports.redisPub.xadd(streamName, '*', ...Object.entries(eventData).flat());
    }
    catch (error) {
        console.error(`Failed to publish to Redis stream ${streamName}:`, error.message);
        // Don't throw - graceful degradation
    }
}
//# sourceMappingURL=redis.js.map
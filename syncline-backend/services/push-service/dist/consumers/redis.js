"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startPushConsumer = startPushConsumer;
exports.stopPushConsumer = stopPushConsumer;
const ioredis_1 = __importDefault(require("ioredis"));
const db_1 = require("../services/db");
const apns_1 = require("../providers/apns");
const fcm_1 = require("../providers/fcm");
const shared_1 = require("@syncline/shared");
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redis = new ioredis_1.default(redisUrl);
const STREAM_NAME = 'syncline:pushes';
const GROUP_NAME = 'push-service-group';
const CONSUMER_NAME = `push-consumer-${process.pid}`;
let running = true;
async function startPushConsumer() {
    console.log(`Starting Redis stream consumer: ${CONSUMER_NAME} on stream: ${STREAM_NAME}`);
    // Create Consumer Group if it doesn't exist
    try {
        await redis.xgroup('CREATE', STREAM_NAME, GROUP_NAME, '$', 'MKSTREAM');
        console.log(`Consumer group ${GROUP_NAME} created.`);
    }
    catch (err) {
        if (err.message.includes('BUSYGROUP')) {
            console.log(`Consumer group ${GROUP_NAME} already exists.`);
        }
        else {
            console.error('Failed to create consumer group:', err);
            // Wait and retry
            setTimeout(startPushConsumer, 5000);
            return;
        }
    }
    // Start consumer loop
    consumeLoop();
}
function stopPushConsumer() {
    running = false;
}
async function consumeLoop() {
    while (running) {
        try {
            // Read pending messages or new messages. '0' reads pending. '>' reads new.
            const streams = (await redis.xreadgroup('GROUP', GROUP_NAME, CONSUMER_NAME, 'COUNT', '10', 'BLOCK', '2000', 'STREAMS', STREAM_NAME, '>'));
            if (!streams)
                continue;
            for (const stream of streams) {
                const [_, messages] = stream;
                for (const message of messages) {
                    const [messageId, fields] = message;
                    // Parse stream fields (array of key, value pairs)
                    const data = {};
                    for (let i = 0; i < fields.length; i += 2) {
                        data[fields[i]] = fields[i + 1];
                    }
                    try {
                        await processPushEvent(data);
                        // ACK message
                        await redis.xack(STREAM_NAME, GROUP_NAME, messageId);
                    }
                    catch (err) {
                        console.error(`Error processing push message ${messageId}:`, err);
                        // Check retry attempts (stored in metadata or incremented in Redis)
                        const attempts = parseInt(data.attempts || '0', 10);
                        if (attempts < 3) {
                            // Re-publish to the stream with incremented attempts
                            const updatedData = { ...data, attempts: (attempts + 1).toString() };
                            // Wait with backoff
                            const backoffMs = Math.pow(2, attempts) * 1000;
                            setTimeout(async () => {
                                await redis.xadd(STREAM_NAME, '*', ...Object.entries(updatedData).flat());
                            }, backoffMs);
                        }
                        else {
                            console.error(`Push message ${messageId} exceeded max retries. Moving to Dead Letters.`);
                            // Publish to Dead Letter Queue
                            await redis.xadd('syncline:dead_letters', '*', ...Object.entries(data).flat());
                        }
                        // ACK original message to remove it from this queue
                        await redis.xack(STREAM_NAME, GROUP_NAME, messageId);
                    }
                }
            }
        }
        catch (err) {
            console.error('Error in Redis consume loop:', err);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}
async function processPushEvent(data) {
    const { userId, eventType, payload, deviceId } = data;
    if (!userId || !eventType || !payload) {
        throw new Error('Malformed push event data');
    }
    // Look up device info
    const deviceQuery = await db_1.pool.query(`SELECT platform, push_token 
     FROM devices 
     WHERE id = $1`, [deviceId]);
    if (deviceQuery.rows.length === 0) {
        console.warn(`No registered push device found for ID: ${deviceId}. Cannot deliver push.`);
        return;
    }
    const { platform, push_token } = deviceQuery.rows[0];
    if (!push_token) {
        console.warn(`Device ${deviceId} has empty push token. Skipping.`);
        return;
    }
    const parsedPayload = JSON.parse(payload);
    if (platform === 'ios') {
        // Determine if call VoIP push
        const isVoip = eventType === shared_1.EventType.CALL && parsedPayload.payload?.status === 'ringing';
        const success = await (0, apns_1.sendApnsNotification)(push_token, eventType, parsedPayload, isVoip);
        if (!success) {
            throw new Error('APNs delivery failed');
        }
    }
    else if (platform === 'android') {
        const success = await (0, fcm_1.sendFcmNotification)(push_token, eventType, parsedPayload);
        if (!success) {
            throw new Error('FCM delivery failed');
        }
    }
}
//# sourceMappingURL=redis.js.map
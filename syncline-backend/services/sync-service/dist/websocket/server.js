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
Object.defineProperty(exports, "__esModule", { value: true });
exports.initWebSocketServer = initWebSocketServer;
const ws_1 = require("ws");
const db_1 = require("../services/db");
const redis_1 = require("../services/redis");
const shared_1 = require("@syncline/shared");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const connections = new Map();
// Setup JWT options (similar to auth-service)
let jwtOptions;
function getJwtOptions() {
    if (jwtOptions)
        return jwtOptions;
    const algorithm = (process.env.JWT_ALGORITHM || 'HS256');
    let privateKeyOrSecret = process.env.JWT_SECRET || 'super_secret_fallback_key';
    let publicKeyOrSecret = process.env.JWT_SECRET || 'super_secret_fallback_key';
    if (algorithm === 'RS256') {
        try {
            const privateKeyPath = process.env.JWT_PRIVATE_KEY_PATH || path.join(__dirname, '../../../auth-service/keys/private.pem');
            const publicKeyPath = process.env.JWT_PUBLIC_KEY_PATH || path.join(__dirname, '../../../auth-service/keys/public.pem');
            privateKeyOrSecret = fs.readFileSync(privateKeyPath, 'utf8');
            publicKeyOrSecret = fs.readFileSync(publicKeyPath, 'utf8');
        }
        catch {
            // Fallback
        }
    }
    jwtOptions = { privateKeyOrSecret, publicKeyOrSecret, algorithm };
    return jwtOptions;
}
function initWebSocketServer(wss) {
    // Subscribe to Redis pub/sub channel for cross-node message routing
    redis_1.redisSub.subscribe('sync-events', (err) => {
        if (err) {
            console.error('Failed to subscribe to sync-events channel:', err);
        }
    });
    redis_1.redisSub.on('message', (channel, message) => {
        if (channel === 'sync-events') {
            try {
                const { targetDeviceId, wsMessage } = JSON.parse(message);
                const conn = connections.get(targetDeviceId);
                if (conn && conn.ws.readyState === ws_1.WebSocket.OPEN) {
                    conn.ws.send(JSON.stringify(wsMessage));
                }
            }
            catch (err) {
                console.error('Error handling Redis PubSub message:', err);
            }
        }
    });
    wss.on('connection', (ws) => {
        let clientConn = {
            ws,
            userId: '',
            deviceId: '',
            platform: 'android',
            pairedDeviceId: null,
            isAuthenticated: false,
            lastPing: Date.now(),
        };
        const pingInterval = setInterval(() => {
            if (!clientConn.isAuthenticated)
                return;
            if (Date.now() - clientConn.lastPing > 40000) {
                console.log(`Connection timeout for device: ${clientConn.deviceId}`);
                ws.close();
                return;
            }
            if (ws.readyState === ws_1.WebSocket.OPEN) {
                ws.send(JSON.stringify(shared_1.MessageFactory.heartbeatPong()));
            }
        }, 30000);
        ws.on('message', async (data) => {
            try {
                const rawMessage = JSON.parse(data);
                if (!(0, shared_1.validateWSMessage)(rawMessage)) {
                    ws.send(JSON.stringify(shared_1.MessageFactory.error('ERR_BAD_REQUEST', 'Invalid message format')));
                    return;
                }
                const msg = rawMessage;
                // 1. Authenticate check
                if (msg.type === shared_1.WSMessageType.AUTH) {
                    const authPayload = msg.payload;
                    try {
                        const tokenPayload = (0, shared_1.verifyAccessToken)(authPayload.accessToken, getJwtOptions());
                        // Validate device
                        const deviceQuery = await db_1.pool.query('SELECT platform FROM devices WHERE id = $1', [authPayload.deviceId]);
                        if (deviceQuery.rows.length === 0) {
                            ws.send(JSON.stringify(shared_1.MessageFactory.authFail('Device not registered')));
                            ws.close();
                            return;
                        }
                        const platform = deviceQuery.rows[0].platform;
                        // Load pairing info
                        const pairQuery = await db_1.pool.query(`SELECT id, android_device_id, ios_device_id 
               FROM users 
               WHERE android_device_id = $1 OR ios_device_id = $1`, [authPayload.deviceId]);
                        let pairedDeviceId = null;
                        if (pairQuery.rows.length > 0) {
                            const userRow = pairQuery.rows[0];
                            pairedDeviceId = platform === 'android' ? userRow.ios_device_id : userRow.android_device_id;
                        }
                        clientConn.userId = tokenPayload.sub;
                        clientConn.deviceId = authPayload.deviceId;
                        clientConn.platform = platform;
                        clientConn.pairedDeviceId = pairedDeviceId;
                        clientConn.isAuthenticated = true;
                        clientConn.lastPing = Date.now();
                        connections.set(authPayload.deviceId, clientConn);
                        ws.send(JSON.stringify(shared_1.MessageFactory.authOk({
                            paired: pairedDeviceId !== null,
                            pairedDeviceId: pairedDeviceId || undefined
                        })));
                        console.log(`Device connected: ${authPayload.deviceId} (${platform}) for user ${tokenPayload.sub}`);
                        // Flush offline queue if iOS reconnected
                        if (platform === 'ios') {
                            await flushOfflineQueue(clientConn);
                        }
                        // Update last_seen in DB
                        await db_1.pool.query('UPDATE devices SET last_seen = CURRENT_TIMESTAMP WHERE id = $1', [clientConn.deviceId]);
                    }
                    catch (err) {
                        ws.send(JSON.stringify(shared_1.MessageFactory.authFail('Token invalid or expired')));
                        ws.close();
                    }
                    return;
                }
                if (!clientConn.isAuthenticated) {
                    ws.send(JSON.stringify(shared_1.MessageFactory.error('ERR_UNAUTHORIZED', 'Not authenticated')));
                    ws.close();
                    return;
                }
                // Keepalive update
                clientConn.lastPing = Date.now();
                // 2. Route messages
                switch (msg.type) {
                    case shared_1.WSMessageType.HEARTBEAT_PING:
                        ws.send(JSON.stringify(shared_1.MessageFactory.heartbeatPong()));
                        break;
                    case shared_1.WSMessageType.SMS_EVENT:
                        await handleSmsEvent(clientConn, msg);
                        break;
                    case shared_1.WSMessageType.CALL_EVENT:
                        await handleCallEvent(clientConn, msg);
                        break;
                    case shared_1.WSMessageType.NOTIFICATION_EVENT:
                        await handleNotificationEvent(clientConn, msg);
                        break;
                    case shared_1.WSMessageType.ACK:
                        await handleAck(clientConn, msg);
                        break;
                    default:
                        ws.send(JSON.stringify(shared_1.MessageFactory.error('ERR_BAD_REQUEST', 'Unknown message type')));
                }
            }
            catch (err) {
                console.error('Error handling message:', err);
                ws.send(JSON.stringify(shared_1.MessageFactory.error('ERR_INTERNAL_ERROR', 'Failed to process message')));
            }
        });
        ws.on('close', () => {
            clearInterval(pingInterval);
            if (clientConn.deviceId) {
                connections.delete(clientConn.deviceId);
                console.log(`Device disconnected: ${clientConn.deviceId}`);
            }
        });
    });
}
async function handleSmsEvent(conn, msg) {
    const { sender, contentEncrypted, contentIv, receivedAt, messageHash } = msg.payload;
    try {
        // Save to Postgres (avoid duplicates via hash constraint)
        const res = await db_1.pool.query(`INSERT INTO sms_events (user_id, sender, content_encrypted, content_iv, message_hash, received_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, message_hash) DO NOTHING
       RETURNING id`, [conn.userId, sender, contentEncrypted, contentIv, messageHash, new Date(receivedAt)]);
        if (res.rows.length === 0) {
            // Duplicate, already handled. Just ACK.
            conn.ws.send(JSON.stringify(shared_1.MessageFactory.eventAck(msg.id, 'delivered')));
            return;
        }
        const eventId = res.rows[0].id;
        const wsEvent = shared_1.MessageFactory.smsReceived({
            id: eventId,
            sender,
            contentEncrypted,
            contentIv,
            receivedAt,
        });
        // Send to iOS if online
        let delivered = false;
        if (conn.pairedDeviceId) {
            delivered = await routeMessage(conn.pairedDeviceId, wsEvent);
        }
        if (delivered) {
            conn.ws.send(JSON.stringify(shared_1.MessageFactory.eventAck(msg.id, 'delivered')));
        }
        else {
            // Put in offline queue & publish to push notification stream
            await addToOfflineQueue(conn.userId, shared_1.EventType.SMS, JSON.stringify(wsEvent), '');
            // Publish to Redis Stream for Push Notifications
            await (0, redis_1.publishToStream)('syncline:pushes', {
                userId: conn.userId,
                eventType: shared_1.EventType.SMS,
                payload: JSON.stringify(wsEvent),
                deviceId: conn.pairedDeviceId || '',
            });
            conn.ws.send(JSON.stringify(shared_1.MessageFactory.eventAck(msg.id, 'queued')));
        }
    }
    catch (err) {
        console.error('Error saving/routing SMS event:', err);
        conn.ws.send(JSON.stringify(shared_1.MessageFactory.error('ERR_INTERNAL_ERROR', 'Failed to route SMS')));
    }
}
async function handleCallEvent(conn, msg) {
    const { caller, callerName, status, startedAt, answeredAt, endedAt } = msg.payload;
    try {
        const duration = (endedAt && startedAt) ? Math.floor((endedAt - startedAt) / 1000) : null;
        // Log call event
        const res = await db_1.pool.query(`INSERT INTO call_events (user_id, caller, caller_name, status, started_at, answered_at, ended_at, duration_sec)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`, [
            conn.userId,
            caller,
            callerName,
            status,
            new Date(startedAt),
            answeredAt ? new Date(answeredAt) : null,
            endedAt ? new Date(endedAt) : null,
            duration
        ]);
        const eventId = res.rows[0].id;
        const wsEvent = shared_1.MessageFactory.callReceived({
            id: eventId,
            caller,
            callerName,
            status,
            startedAt,
            answeredAt,
            endedAt,
        });
        // Call events must trigger dynamic alerts.
        // Route to iOS if online
        let delivered = false;
        if (conn.pairedDeviceId) {
            delivered = await routeMessage(conn.pairedDeviceId, wsEvent);
        }
        // Always push notification for calls, especially ringing (VOIP push)
        if (status === 'ringing') {
            await (0, redis_1.publishToStream)('syncline:pushes', {
                userId: conn.userId,
                eventType: shared_1.EventType.CALL,
                payload: JSON.stringify(wsEvent),
                deviceId: conn.pairedDeviceId || '',
            });
        }
        conn.ws.send(JSON.stringify(shared_1.MessageFactory.eventAck(msg.id, delivered ? 'delivered' : 'queued')));
    }
    catch (err) {
        console.error('Error saving/routing call event:', err);
        conn.ws.send(JSON.stringify(shared_1.MessageFactory.error('ERR_INTERNAL_ERROR', 'Failed to route call event')));
    }
}
async function handleNotificationEvent(conn, msg) {
    // Similar to SMS, mirror notifications to iOS if whitelist matches
    const { packageName, appName, title, contentEncrypted, contentIv, postedAt } = msg.payload;
    try {
        // For MVP, we pass notifications directly without DB persistence, or offline queue only
        const wsEvent = shared_1.MessageFactory.notificationReceived({
            id: msg.id,
            packageName,
            appName,
            title,
            contentEncrypted,
            contentIv,
            postedAt
        });
        let delivered = false;
        if (conn.pairedDeviceId) {
            delivered = await routeMessage(conn.pairedDeviceId, wsEvent);
        }
        if (!delivered) {
            await (0, redis_1.publishToStream)('syncline:pushes', {
                userId: conn.userId,
                eventType: shared_1.EventType.NOTIFICATION,
                payload: JSON.stringify(wsEvent),
                deviceId: conn.pairedDeviceId || '',
            });
        }
        conn.ws.send(JSON.stringify(shared_1.MessageFactory.eventAck(msg.id, delivered ? 'delivered' : 'queued')));
    }
    catch (err) {
        console.error('Error handling notification event:', err);
    }
}
async function handleAck(conn, msg) {
    const { eventId, eventType } = msg.payload;
    try {
        if (eventType === shared_1.EventType.SMS) {
            await db_1.pool.query('UPDATE sms_events SET delivered_at = CURRENT_TIMESTAMP WHERE id = $1', [eventId]);
        }
        // Delete from offline queue
        await db_1.pool.query(`DELETE FROM offline_queue 
       WHERE user_id = $1 AND (payload_encrypted LIKE $2 OR payload_encrypted LIKE $3)`, [conn.userId, `%${eventId}%`, `%${msg.id}%`]);
    }
    catch (err) {
        console.error('Error processing ACK:', err);
    }
}
async function routeMessage(targetDeviceId, wsMessage) {
    const localConn = connections.get(targetDeviceId);
    if (localConn && localConn.ws.readyState === ws_1.WebSocket.OPEN) {
        localConn.ws.send(JSON.stringify(wsMessage));
        return true;
    }
    // Cross-node pub/sub trigger
    try {
        const payload = JSON.stringify({ targetDeviceId, wsMessage });
        const receivers = await redis_1.redisPub.publish('sync-events', payload);
        return receivers > 0;
    }
    catch (err) {
        console.error('Redis PubSub publish failed:', err);
        return false;
    }
}
async function addToOfflineQueue(userId, eventType, payload, iv) {
    await db_1.pool.query(`INSERT INTO offline_queue (user_id, event_type, payload_encrypted, payload_iv)
     VALUES ($1, $2, $3, $4)`, [userId, eventType, payload, iv]);
}
async function flushOfflineQueue(conn) {
    try {
        const res = await db_1.pool.query(`SELECT id, event_type, payload_encrypted, payload_iv 
       FROM offline_queue 
       WHERE user_id = $1 
       ORDER BY created_at ASC`, [conn.userId]);
        if (res.rows.length === 0)
            return;
        console.log(`Flushing ${res.rows.length} offline events to iOS device ${conn.deviceId}`);
        const events = [];
        for (const row of res.rows) {
            try {
                const rawEvent = JSON.parse(row.payload_encrypted);
                events.push(rawEvent);
            }
            catch (err) {
                // Corrupt JSON payload, delete it
                await db_1.pool.query('DELETE FROM offline_queue WHERE id = $1', [row.id]);
            }
        }
        if (events.length > 0) {
            const flushMsg = shared_1.MessageFactory.offlineFlush(events);
            conn.ws.send(JSON.stringify(flushMsg));
        }
    }
    catch (err) {
        console.error('Failed to flush offline queue:', err);
    }
}
//# sourceMappingURL=server.js.map
import { WebSocket } from 'ws';
import { FastifyRequest } from 'fastify';
import { pool } from '../services/db';
import { redisPub, redisSub, publishToStream, isRedisConnected } from '../services/redis';
import { 
  WSMessage, 
  WSMessageType, 
  WSAuthPayload, 
  WSAckPayload, 
  WSSmsPayload, 
  WSCallPayload, 
  WSNotificationPayload, 
  validateWSMessage, 
  MessageFactory,
  verifyAccessToken,
  JwtOptions,
  EventType
} from '@syncline/shared';
import * as fs from 'fs';
import * as path from 'path';

// Active WebSocket connections: deviceId -> WebSocket info
interface ActiveConnection {
  ws: WebSocket;
  userId: string;
  deviceId: string;
  platform: 'android' | 'ios';
  pairedDeviceId: string | null;
  isAuthenticated: boolean;
  lastPing: number;
}

const connections = new Map<string, ActiveConnection>();

// Setup JWT options
let jwtOptions: JwtOptions;
function getJwtOptions(): JwtOptions {
  if (jwtOptions) return jwtOptions;
  const algorithm = (process.env.JWT_ALGORITHM || 'HS256') as any;
  let privateKeyOrSecret = process.env.JWT_SECRET || 'super_secret_fallback_key';
  let publicKeyOrSecret = process.env.JWT_SECRET || 'super_secret_fallback_key';

  if (algorithm === 'RS256') {
    try {
      const privateKeyPath = process.env.JWT_PRIVATE_KEY_PATH || path.join(__dirname, '../keys/private.pem');
      const publicKeyPath = process.env.JWT_PUBLIC_KEY_PATH || path.join(__dirname, '../keys/public.pem');
      privateKeyOrSecret = fs.readFileSync(privateKeyPath, 'utf8');
      publicKeyOrSecret = fs.readFileSync(publicKeyPath, 'utf8');
    } catch {
      // Fallback
    }
  }

  jwtOptions = { privateKeyOrSecret, publicKeyOrSecret, algorithm };
  return jwtOptions;
}

/**
 * Initialize Redis pub/sub subscription for cross-node messaging.
 * Call this once at startup, after Redis is connected.
 */
export function initRedisSubscription() {
  try {
    if (isRedisConnected()) {
      redisSub.subscribe('sync-events', (err) => {
        if (err) {
          console.error('Failed to subscribe to sync-events channel:', err);
        } else {
          console.log('[Redis] Subscribed to sync-events channel');
        }
      });

      redisSub.on('message', (channel, message) => {
        if (channel === 'sync-events') {
          try {
            const { targetDeviceId, wsMessage } = JSON.parse(message);
            const conn = connections.get(targetDeviceId);
            if (conn && conn.ws.readyState === WebSocket.OPEN) {
              conn.ws.send(JSON.stringify(wsMessage));
            }
          } catch (err) {
            console.error('Error handling Redis PubSub message:', err);
          }
        }
      });
    } else {
      console.warn('[Redis] Not connected, cross-node messaging disabled');
    }
  } catch (err) {
    console.warn('[Redis] Failed to setup PubSub (non-fatal):', err);
  }
}

/**
 * Handle a single WebSocket connection from the Fastify /ws route.
 * Called by Fastify's @fastify/websocket plugin for each new connection.
 */
export function handleWebSocketConnection(ws: WebSocket, req: FastifyRequest) {
  console.log(`[WS] WebSocket connection handler started for ${req.ip}`);
  
  let clientConn: ActiveConnection = {
    ws,
    userId: '',
    deviceId: '',
    platform: 'android',
    pairedDeviceId: null,
    isAuthenticated: false,
    lastPing: Date.now(),
  };

  const pingInterval = setInterval(() => {
    if (!clientConn.isAuthenticated) return;
    
    if (Date.now() - clientConn.lastPing > 40000) {
      console.log(`[WS] Connection timeout for device: ${clientConn.deviceId}`);
      ws.close();
      return;
    }
    
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(MessageFactory.heartbeatPong()));
    }
  }, 30000);

  ws.on('message', async (data: string) => {
    try {
      const rawMessage = JSON.parse(data.toString());
      if (!validateWSMessage(rawMessage)) {
        ws.send(JSON.stringify(MessageFactory.error('ERR_BAD_REQUEST', 'Invalid message format')));
        return;
      }

      const msg = rawMessage as WSMessage;

      // 1. Authenticate check
      if (msg.type === WSMessageType.AUTH) {
        const authPayload = msg.payload as WSAuthPayload;
        try {
          const tokenPayload = verifyAccessToken(authPayload.accessToken, getJwtOptions());
          
          // Validate device
          const deviceQuery = await pool.query('SELECT platform FROM devices WHERE id = $1', [authPayload.deviceId]);
          if (deviceQuery.rows.length === 0) {
            ws.send(JSON.stringify(MessageFactory.authFail('Device not registered')));
            ws.close();
            return;
          }

          const platform = deviceQuery.rows[0].platform;

          // Load pairing info
          const pairQuery = await pool.query(
            `SELECT id, android_device_id, ios_device_id 
             FROM users 
             WHERE android_device_id = $1 OR ios_device_id = $1`,
            [authPayload.deviceId]
          );

          let pairedDeviceId: string | null = null;
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

          ws.send(JSON.stringify(MessageFactory.authOk({ 
            paired: pairedDeviceId !== null, 
            pairedDeviceId: pairedDeviceId || undefined 
          })));

          console.log(`[WS] Device connected: ${authPayload.deviceId} (${platform}) for user ${tokenPayload.sub}`);

          // Flush offline queue if iOS reconnected
          if (platform === 'ios') {
            await flushOfflineQueue(clientConn);
          }

          // Update last_seen in DB
          await pool.query('UPDATE devices SET last_seen = CURRENT_TIMESTAMP WHERE id = $1', [clientConn.deviceId]);
        } catch (err) {
          ws.send(JSON.stringify(MessageFactory.authFail('Token invalid or expired')));
          ws.close();
        }
        return;
      }

      if (!clientConn.isAuthenticated) {
        ws.send(JSON.stringify(MessageFactory.error('ERR_UNAUTHORIZED', 'Not authenticated')));
        ws.close();
        return;
      }

      // Keepalive update
      clientConn.lastPing = Date.now();

      // 2. Route messages
      switch (msg.type) {
        case WSMessageType.HEARTBEAT_PING:
          ws.send(JSON.stringify(MessageFactory.heartbeatPong()));
          break;

        case WSMessageType.SMS_EVENT:
          await handleSmsEvent(clientConn, msg as WSMessage<WSSmsPayload>);
          break;

        case WSMessageType.CALL_EVENT:
          await handleCallEvent(clientConn, msg as WSMessage<WSCallPayload>);
          break;

        case WSMessageType.NOTIFICATION_EVENT:
          await handleNotificationEvent(clientConn, msg as WSMessage<WSNotificationPayload>);
          break;

        case WSMessageType.ACK:
          await handleAck(clientConn, msg as WSMessage<WSAckPayload>);
          break;

        default:
          ws.send(JSON.stringify(MessageFactory.error('ERR_BAD_REQUEST', 'Unknown message type')));
      }
    } catch (err) {
      console.error('[WS] Error handling message:', err);
      ws.send(JSON.stringify(MessageFactory.error('ERR_INTERNAL_ERROR', 'Failed to process message')));
    }
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    if (clientConn.deviceId) {
      connections.delete(clientConn.deviceId);
      console.log(`[WS] Device disconnected: ${clientConn.deviceId}`);
    }
  });

  ws.on('error', (err) => {
    console.error(`[WS] WebSocket error for device ${clientConn.deviceId}:`, err.message);
  });
}

async function handleSmsEvent(conn: ActiveConnection, msg: WSMessage<WSSmsPayload>) {
  const { sender, contentEncrypted, contentIv, receivedAt, messageHash } = msg.payload;

  try {
    // Save to Postgres (avoid duplicates via hash constraint)
    const res = await pool.query(
      `INSERT INTO sms_events (user_id, sender, content_encrypted, content_iv, message_hash, received_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, message_hash) DO NOTHING
       RETURNING id`,
      [conn.userId, sender, contentEncrypted, contentIv, messageHash, new Date(receivedAt)]
    );

    if (res.rows.length === 0) {
      // Duplicate, already handled. Just ACK.
      conn.ws.send(JSON.stringify(MessageFactory.eventAck(msg.id, 'delivered')));
      return;
    }

    const eventId = res.rows[0].id;
    const wsEvent = MessageFactory.smsReceived({
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
      conn.ws.send(JSON.stringify(MessageFactory.eventAck(msg.id, 'delivered')));
    } else {
      // Put in offline queue & publish to push notification stream
      await addToOfflineQueue(conn.userId, EventType.SMS, JSON.stringify(wsEvent), '');
      
      // Publish to Redis Stream for Push Notifications
      await publishToStream('syncline:pushes', {
        userId: conn.userId,
        eventType: EventType.SMS,
        payload: JSON.stringify(wsEvent),
        deviceId: conn.pairedDeviceId || '',
      });

      conn.ws.send(JSON.stringify(MessageFactory.eventAck(msg.id, 'queued')));
    }
  } catch (err) {
    console.error('Error saving/routing SMS event:', err);
    conn.ws.send(JSON.stringify(MessageFactory.error('ERR_INTERNAL_ERROR', 'Failed to route SMS')));
  }
}

async function handleCallEvent(conn: ActiveConnection, msg: WSMessage<WSCallPayload>) {
  const { caller, callerName, status, startedAt, answeredAt, endedAt } = msg.payload;

  try {
    const duration = (endedAt && startedAt) ? Math.floor((endedAt - startedAt) / 1000) : null;
    
    // Log call event
    const res = await pool.query(
      `INSERT INTO call_events (user_id, caller, caller_name, status, started_at, answered_at, ended_at, duration_sec)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        conn.userId, 
        caller, 
        callerName, 
        status, 
        new Date(startedAt), 
        answeredAt ? new Date(answeredAt) : null,
        endedAt ? new Date(endedAt) : null,
        duration
      ]
    );

    const eventId = res.rows[0].id;
    const wsEvent = MessageFactory.callReceived({
      id: eventId,
      caller,
      callerName,
      status,
      startedAt,
      answeredAt,
      endedAt,
    });

    // Route to iOS if online
    let delivered = false;
    if (conn.pairedDeviceId) {
      delivered = await routeMessage(conn.pairedDeviceId, wsEvent);
    }

    // Always push notification for calls, especially ringing (VOIP push)
    if (status === 'ringing') {
      await publishToStream('syncline:pushes', {
        userId: conn.userId,
        eventType: EventType.CALL,
        payload: JSON.stringify(wsEvent),
        deviceId: conn.pairedDeviceId || '',
      });
    }

    conn.ws.send(JSON.stringify(MessageFactory.eventAck(msg.id, delivered ? 'delivered' : 'queued')));
  } catch (err) {
    console.error('Error saving/routing call event:', err);
    conn.ws.send(JSON.stringify(MessageFactory.error('ERR_INTERNAL_ERROR', 'Failed to route call event')));
  }
}

async function handleNotificationEvent(conn: ActiveConnection, msg: WSMessage<WSNotificationPayload>) {
  const { packageName, appName, title, contentEncrypted, contentIv, postedAt } = msg.payload;
  
  try {
    const wsEvent = MessageFactory.notificationReceived({
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
      await publishToStream('syncline:pushes', {
        userId: conn.userId,
        eventType: EventType.NOTIFICATION,
        payload: JSON.stringify(wsEvent),
        deviceId: conn.pairedDeviceId || '',
      });
    }

    conn.ws.send(JSON.stringify(MessageFactory.eventAck(msg.id, delivered ? 'delivered' : 'queued')));
  } catch (err) {
    console.error('Error handling notification event:', err);
  }
}

async function handleAck(conn: ActiveConnection, msg: WSMessage<WSAckPayload>) {
  const { eventId, eventType } = msg.payload;
  try {
    if (eventType === EventType.SMS) {
      await pool.query('UPDATE sms_events SET delivered_at = CURRENT_TIMESTAMP WHERE id = $1', [eventId]);
    }
    // Delete from offline queue
    await pool.query(
      `DELETE FROM offline_queue 
       WHERE user_id = $1 AND (payload_encrypted LIKE $2 OR payload_encrypted LIKE $3)`,
      [conn.userId, `%${eventId}%`, `%${msg.id}%`]
    );
  } catch (err) {
    console.error('Error processing ACK:', err);
  }
}

async function routeMessage(targetDeviceId: string, wsMessage: WSMessage): Promise<boolean> {
  const localConn = connections.get(targetDeviceId);
  if (localConn && localConn.ws.readyState === WebSocket.OPEN) {
    localConn.ws.send(JSON.stringify(wsMessage));
    return true;
  }

  // Cross-node pub/sub trigger
  try {
    const payload = JSON.stringify({ targetDeviceId, wsMessage });
    const receivers = await redisPub.publish('sync-events', payload);
    return receivers > 0;
  } catch (err) {
    console.error('Redis PubSub publish failed:', err);
    return false;
  }
}

async function addToOfflineQueue(userId: string, eventType: string, payload: string, iv: string) {
  await pool.query(
    `INSERT INTO offline_queue (user_id, event_type, payload_encrypted, payload_iv)
     VALUES ($1, $2, $3, $4)`,
    [userId, eventType, payload, iv]
  );
}

async function flushOfflineQueue(conn: ActiveConnection) {
  try {
    const res = await pool.query(
      `SELECT id, event_type, payload_encrypted, payload_iv 
       FROM offline_queue 
       WHERE user_id = $1 
       ORDER BY created_at ASC`,
      [conn.userId]
    );

    if (res.rows.length === 0) return;

    console.log(`[WS] Flushing ${res.rows.length} offline events to iOS device ${conn.deviceId}`);
    const events: WSMessage[] = [];

    for (const row of res.rows) {
      try {
        const rawEvent = JSON.parse(row.payload_encrypted);
        events.push(rawEvent);
      } catch (err) {
        // Corrupt JSON payload, delete it
        await pool.query('DELETE FROM offline_queue WHERE id = $1', [row.id]);
      }
    }

    if (events.length > 0) {
      const flushMsg = MessageFactory.offlineFlush(events);
      conn.ws.send(JSON.stringify(flushMsg));
    }
  } catch (err) {
    console.error('Failed to flush offline queue:', err);
  }
}

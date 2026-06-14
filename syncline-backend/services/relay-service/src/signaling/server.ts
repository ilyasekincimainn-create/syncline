import { WebSocket } from 'ws';
import { 
  verifyAccessToken, 
  JwtOptions, 
  generateTurnCredentials,
  SignalingMessage,
  SignalingMessageType
} from '@syncline/shared';
import Redis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redisPub = new Redis(redisUrl);
const redisSub = new Redis(redisUrl);

interface ActiveSession {
  callId: string;
  androidDeviceId: string;
  iosDeviceId: string;
  createdAt: number;
  timeoutTimer: NodeJS.Timeout;
}

// Memory stores for local node
const socketMap = new Map<string, WebSocket>(); // deviceId -> socket
const sessionMap = new Map<string, ActiveSession>(); // callId -> Session metadata

let jwtOptions: JwtOptions;
function getJwtOptions(): JwtOptions {
  if (jwtOptions) return jwtOptions;
  const algorithm = (process.env.JWT_ALGORITHM || 'HS256') as any;
  let privateKeyOrSecret = process.env.JWT_SECRET || 'super_secret_fallback_key';
  let publicKeyOrSecret = process.env.JWT_SECRET || 'super_secret_fallback_key';

  if (algorithm === 'RS256') {
    try {
      const privateKeyPath = process.env.JWT_PRIVATE_KEY_PATH || path.join(__dirname, '../../../auth-service/keys/private.pem');
      const publicKeyPath = process.env.JWT_PUBLIC_KEY_PATH || path.join(__dirname, '../../../auth-service/keys/public.pem');
      privateKeyOrSecret = fs.readFileSync(privateKeyPath, 'utf8');
      publicKeyOrSecret = fs.readFileSync(publicKeyPath, 'utf8');
    } catch {
      // Fallback
    }
  }
  jwtOptions = { privateKeyOrSecret, publicKeyOrSecret, algorithm };
  return jwtOptions;
}

export function initSignalingServer(wss: any) {
  // Subscribe to cross-node signaling
  redisSub.subscribe('relay-signaling', (err) => {
    if (err) console.error('Redis subscription to relay-signaling failed:', err);
  });

  redisSub.on('message', (channel, message) => {
    if (channel === 'relay-signaling') {
      try {
        const signal = JSON.parse(message) as SignalingMessage;
        const targetSocket = socketMap.get(signal.targetId);
        if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
          targetSocket.send(JSON.stringify(signal));
        }
      } catch (err) {
        console.error('Error parsing cross-node signal:', err);
      }
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    let deviceId = '';
    let isAuthenticated = false;

    ws.on('message', async (data: string) => {
      try {
        const msg = JSON.parse(data);
        
        // 1. Connection Authentication
        if (msg.type === 'auth') {
          const { accessToken, deviceId: devId } = msg.payload;
          try {
            verifyAccessToken(accessToken, getJwtOptions());
            deviceId = devId;
            isAuthenticated = true;
            socketMap.set(deviceId, ws);
            
            // Generate TURN configurations to send to client
            const turnSecret = process.env.TURN_SECRET || 'coturn_shared_secret';
            const turnUris = (process.env.TURN_URIS || 'turn:localhost:3478?transport=udp,turn:localhost:3478?transport=tcp').split(',');
            const credentials = generateTurnCredentials(turnSecret, deviceId, turnUris, 3600);
            
            ws.send(JSON.stringify({
              type: 'auth_ok',
              payload: {
                turn: credentials
              }
            }));
            console.log(`WebRTC socket authenticated for device: ${deviceId}`);
          } catch (err) {
            ws.send(JSON.stringify({ type: 'auth_fail', payload: { reason: 'Invalid token' } }));
            ws.close();
          }
          return;
        }

        if (!isAuthenticated) {
          ws.send(JSON.stringify({ type: 'error', payload: { message: 'Not authenticated' } }));
          ws.close();
          return;
        }

        // 2. Signaling Event Routing
        const signal = msg as SignalingMessage;
        signal.senderId = deviceId;

        // Session validation on OFFER
        if (signal.type === SignalingMessageType.OFFER) {
          const timeout = setTimeout(() => {
            handleCallTimeout(signal.callId);
          }, 60000); // 60s unanswered timeout

          sessionMap.set(signal.callId, {
            callId: signal.callId,
            androidDeviceId: signal.senderId,
            iosDeviceId: signal.targetId,
            createdAt: Date.now(),
            timeoutTimer: timeout,
          });
        }

        // Relay to target device (local or cross-node)
        await routeSignal(signal);

        // Session clean-up on HANGUP / REJECT
        if (
          signal.type === SignalingMessageType.CALL_HANGUP ||
          signal.type === SignalingMessageType.CALL_REJECT ||
          signal.type === SignalingMessageType.CALL_BUSY
        ) {
          clearCallSession(signal.callId);
        }

        // Clear timeout timer on call accept
        if (signal.type === SignalingMessageType.CALL_ACCEPT) {
          const session = sessionMap.get(signal.callId);
          if (session) {
            clearTimeout(session.timeoutTimer);
          }
        }

      } catch (err) {
        console.error('Signaling server message error:', err);
      }
    });

    ws.on('close', () => {
      if (deviceId) {
        socketMap.delete(deviceId);
        console.log(`WebRTC socket closed for device: ${deviceId}`);
      }
    });
  });
}

async function routeSignal(signal: SignalingMessage) {
  const localTarget = socketMap.get(signal.targetId);
  if (localTarget && localTarget.readyState === WebSocket.OPEN) {
    localTarget.send(JSON.stringify(signal));
  } else {
    // Publish to Redis PubSub for cross-node instances
    await redisPub.publish('relay-signaling', JSON.stringify(signal));
  }
}

function clearCallSession(callId: string) {
  const session = sessionMap.get(callId);
  if (session) {
    clearTimeout(session.timeoutTimer);
    sessionMap.delete(callId);
    console.log(`Call session ${callId} cleaned up.`);
  }
}

async function handleCallTimeout(callId: string) {
  const session = sessionMap.get(callId);
  if (!session) return;

  console.log(`Call ${callId} timed out unanswered.`);

  const timeoutMsg: SignalingMessage = {
    type: SignalingMessageType.CALL_HANGUP,
    callId,
    senderId: 'server',
    targetId: session.iosDeviceId,
    payload: { reason: 'unanswered_timeout' },
    timestamp: Date.now(),
  };

  const timeoutMsgAndroid: SignalingMessage = {
    ...timeoutMsg,
    targetId: session.androidDeviceId,
  };

  await routeSignal(timeoutMsg);
  await routeSignal(timeoutMsgAndroid);
  
  sessionMap.delete(callId);
}

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
exports.initSignalingServer = initSignalingServer;
const ws_1 = require("ws");
const shared_1 = require("@syncline/shared");
const ioredis_1 = __importDefault(require("ioredis"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redisPub = new ioredis_1.default(redisUrl);
const redisSub = new ioredis_1.default(redisUrl);
// Memory stores for local node
const socketMap = new Map(); // deviceId -> socket
const sessionMap = new Map(); // callId -> Session metadata
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
function initSignalingServer(wss) {
    // Subscribe to cross-node signaling
    redisSub.subscribe('relay-signaling', (err) => {
        if (err)
            console.error('Redis subscription to relay-signaling failed:', err);
    });
    redisSub.on('message', (channel, message) => {
        if (channel === 'relay-signaling') {
            try {
                const signal = JSON.parse(message);
                const targetSocket = socketMap.get(signal.targetId);
                if (targetSocket && targetSocket.readyState === ws_1.WebSocket.OPEN) {
                    targetSocket.send(JSON.stringify(signal));
                }
            }
            catch (err) {
                console.error('Error parsing cross-node signal:', err);
            }
        }
    });
    wss.on('connection', (ws) => {
        let deviceId = '';
        let isAuthenticated = false;
        ws.on('message', async (data) => {
            try {
                const msg = JSON.parse(data);
                // 1. Connection Authentication
                if (msg.type === 'auth') {
                    const { accessToken, deviceId: devId } = msg.payload;
                    try {
                        (0, shared_1.verifyAccessToken)(accessToken, getJwtOptions());
                        deviceId = devId;
                        isAuthenticated = true;
                        socketMap.set(deviceId, ws);
                        // Generate TURN configurations to send to client
                        const turnSecret = process.env.TURN_SECRET || 'coturn_shared_secret';
                        const turnUris = (process.env.TURN_URIS || 'turn:localhost:3478?transport=udp,turn:localhost:3478?transport=tcp').split(',');
                        const credentials = (0, shared_1.generateTurnCredentials)(turnSecret, deviceId, turnUris, 3600);
                        ws.send(JSON.stringify({
                            type: 'auth_ok',
                            payload: {
                                turn: credentials
                            }
                        }));
                        console.log(`WebRTC socket authenticated for device: ${deviceId}`);
                    }
                    catch (err) {
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
                const signal = msg;
                signal.senderId = deviceId;
                // Session validation on OFFER
                if (signal.type === shared_1.SignalingMessageType.OFFER) {
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
                if (signal.type === shared_1.SignalingMessageType.CALL_HANGUP ||
                    signal.type === shared_1.SignalingMessageType.CALL_REJECT ||
                    signal.type === shared_1.SignalingMessageType.CALL_BUSY) {
                    clearCallSession(signal.callId);
                }
                // Clear timeout timer on call accept
                if (signal.type === shared_1.SignalingMessageType.CALL_ACCEPT) {
                    const session = sessionMap.get(signal.callId);
                    if (session) {
                        clearTimeout(session.timeoutTimer);
                    }
                }
            }
            catch (err) {
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
async function routeSignal(signal) {
    const localTarget = socketMap.get(signal.targetId);
    if (localTarget && localTarget.readyState === ws_1.WebSocket.OPEN) {
        localTarget.send(JSON.stringify(signal));
    }
    else {
        // Publish to Redis PubSub for cross-node instances
        await redisPub.publish('relay-signaling', JSON.stringify(signal));
    }
}
function clearCallSession(callId) {
    const session = sessionMap.get(callId);
    if (session) {
        clearTimeout(session.timeoutTimer);
        sessionMap.delete(callId);
        console.log(`Call session ${callId} cleaned up.`);
    }
}
async function handleCallTimeout(callId) {
    const session = sessionMap.get(callId);
    if (!session)
        return;
    console.log(`Call ${callId} timed out unanswered.`);
    const timeoutMsg = {
        type: shared_1.SignalingMessageType.CALL_HANGUP,
        callId,
        senderId: 'server',
        targetId: session.iosDeviceId,
        payload: { reason: 'unanswered_timeout' },
        timestamp: Date.now(),
    };
    const timeoutMsgAndroid = {
        ...timeoutMsg,
        targetId: session.androidDeviceId,
    };
    await routeSignal(timeoutMsg);
    await routeSignal(timeoutMsgAndroid);
    sessionMap.delete(callId);
}
//# sourceMappingURL=server.js.map
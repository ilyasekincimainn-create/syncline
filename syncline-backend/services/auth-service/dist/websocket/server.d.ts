import { WebSocket } from 'ws';
import { FastifyRequest } from 'fastify';
/**
 * Initialize Redis pub/sub subscription for cross-node messaging.
 * Call this once at startup, after Redis is connected.
 */
export declare function initRedisSubscription(): void;
/**
 * Handle a single WebSocket connection from the Fastify /ws route.
 * Called by Fastify's @fastify/websocket plugin for each new connection.
 */
export declare function handleWebSocketConnection(ws: WebSocket, req: FastifyRequest): void;
//# sourceMappingURL=server.d.ts.map
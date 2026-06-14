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
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const auth_1 = require("./routes/auth");
const server_1 = require("./websocket/server");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const fastify = (0, fastify_1.default)({
    logger: {
        level: process.env.LOG_LEVEL || 'info',
        formatters: {
            level: (label) => {
                return { level: label.toUpperCase() };
            },
        },
    },
});
async function main() {
    try {
        // Register CORS
        await fastify.register(cors_1.default, {
            origin: true,
            credentials: true,
        });
        // Register rate limit
        await fastify.register(rate_limit_1.default, {
            max: 100,
            timeWindow: '1 minute',
        });
        // Register @fastify/websocket
        await fastify.register(websocket_1.default, {
            options: {
                maxPayload: 1048576, // 1MB
            }
        });
        // Define websocket route
        fastify.get('/ws', { websocket: true }, () => {
            // Handled by initWebSocketServer through fastify.websocketServer
        });
        // Initialize custom wss logic by hooking to fastify's server
        fastify.ready((err) => {
            if (err)
                throw err;
            const wss = fastify.websocketServer;
            if (!wss) {
                throw new Error('WebSocket server was not initialized');
            }
            (0, server_1.initWebSocketServer)(wss);
            console.log('Sync WebSocket server integrated and initialized successfully.');
        });
        // Register routes
        await fastify.register(auth_1.authRoutes, { prefix: '/api/auth' });
        // Health check
        fastify.get('/health', async () => {
            return { status: 'healthy', service: 'auth-sync-combined-service', timestamp: new Date().toISOString() };
        });
        const port = parseInt(process.env.PORT || '3001', 10);
        const host = process.env.HOST || '0.0.0.0';
        await fastify.listen({ port, host });
        console.log(`Combined Auth & Sync Service is running on http://${host}:${port}`);
    }
    catch (error) {
        fastify.log.error(error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=index.js.map
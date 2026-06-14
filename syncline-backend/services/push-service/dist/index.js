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
const apns_1 = require("./providers/apns");
const fcm_1 = require("./providers/fcm");
const redis_1 = require("./consumers/redis");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const fastify = (0, fastify_1.default)({
    logger: {
        level: process.env.LOG_LEVEL || 'info',
    },
});
async function main() {
    try {
        await fastify.register(cors_1.default, {
            origin: true,
            credentials: true,
        });
        // Initialize push notification providers
        (0, apns_1.initApns)();
        (0, fcm_1.initFcm)();
        // Start consuming background streams
        await (0, redis_1.startPushConsumer)();
        fastify.get('/health', async () => {
            return { status: 'healthy', service: 'push-service', timestamp: new Date().toISOString() };
        });
        const port = parseInt(process.env.PORT || '3003', 10);
        const host = process.env.HOST || '0.0.0.0';
        await fastify.listen({ port, host });
        console.log(`Push Service is running on http://${host}:${port}`);
    }
    catch (error) {
        fastify.log.error(error);
        process.exit(1);
    }
}
// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    (0, redis_1.stopPushConsumer)();
    process.exit(0);
});
main();
//# sourceMappingURL=index.js.map
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
exports.generateTurnCredentials = generateTurnCredentials;
const crypto = __importStar(require("crypto"));
/**
 * Generates dynamic time-limited TURN credentials using HMAC-SHA1
 * compatible with coturn's REST API.
 *
 * @param secret coturn shared secret
 * @param usernamePrefix custom prefix for username, or device uuid
 * @param turnUris list of TURN/STUN server URIs
 * @param ttlSeconds validity duration of the credentials in seconds (default: 3600)
 */
function generateTurnCredentials(secret, usernamePrefix, turnUris, ttlSeconds = 3600) {
    const timestamp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const username = `${timestamp}:${usernamePrefix}`;
    const hmac = crypto.createHmac('sha1', secret);
    hmac.update(username);
    const credential = hmac.digest('base64');
    return {
        username,
        credential,
        uris: turnUris,
        ttl: ttlSeconds,
    };
}
//# sourceMappingURL=turn.js.map
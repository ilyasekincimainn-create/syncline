import { TurnCredentials } from '../types/webrtc';
/**
 * Generates dynamic time-limited TURN credentials using HMAC-SHA1
 * compatible with coturn's REST API.
 *
 * @param secret coturn shared secret
 * @param usernamePrefix custom prefix for username, or device uuid
 * @param turnUris list of TURN/STUN server URIs
 * @param ttlSeconds validity duration of the credentials in seconds (default: 3600)
 */
export declare function generateTurnCredentials(secret: string, usernamePrefix: string, turnUris: string[], ttlSeconds?: number): TurnCredentials;
//# sourceMappingURL=turn.d.ts.map
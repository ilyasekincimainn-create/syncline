import * as crypto from 'crypto';
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
export function generateTurnCredentials(
  secret: string,
  usernamePrefix: string,
  turnUris: string[],
  ttlSeconds: number = 3600
): TurnCredentials {
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

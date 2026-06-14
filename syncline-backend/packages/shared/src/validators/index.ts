import { WSMessage, WSMessageType } from '../types/websocket';

export function validateWSMessage(msg: unknown): msg is WSMessage {
  if (typeof msg !== 'object' || msg === null) return false;
  
  const m = msg as Record<string, unknown>;
  
  if (typeof m.type !== 'string' || !Object.values(WSMessageType).includes(m.type as WSMessageType)) {
    return false;
  }
  
  if (typeof m.id !== 'string' || m.id.trim() === '') {
    return false;
  }
  
  if (typeof m.timestamp !== 'number' || isNaN(m.timestamp)) {
    return false;
  }
  
  if (m.payload === undefined) {
    return false;
  }
  
  return true;
}

export function isValidPairingCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

export function isValidUuid(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
}

import { EventType } from './events';

/** WebSocket message types for the sync protocol */
export enum WSMessageType {
  // Client → Server
  AUTH = 'auth',
  SMS_EVENT = 'sms_event',
  CALL_EVENT = 'call_event',
  NOTIFICATION_EVENT = 'notification_event',
  ACK = 'ack',
  HEARTBEAT_PING = 'heartbeat_ping',

  // Server → Client
  AUTH_OK = 'auth_ok',
  AUTH_FAIL = 'auth_fail',
  SMS_RECEIVED = 'sms_received',
  CALL_RECEIVED = 'call_received',
  NOTIFICATION_RECEIVED = 'notification_received',
  EVENT_ACK = 'event_ack',
  HEARTBEAT_PONG = 'heartbeat_pong',
  ERROR = 'error',

  // Offline queue
  OFFLINE_FLUSH = 'offline_flush',
  OFFLINE_EVENT = 'offline_event',
}

/** Base WebSocket message structure */
export interface WSMessage<T = unknown> {
  type: WSMessageType;
  id: string;          // unique message ID
  timestamp: number;   // Unix timestamp ms
  payload: T;
}

/** Authentication message payload */
export interface WSAuthPayload {
  accessToken: string;
  deviceId: string;
}

/** ACK message payload */
export interface WSAckPayload {
  eventId: string;
  eventType: EventType;
}

/** SMS event payload (from Android) */
export interface WSSmsPayload {
  sender: string;
  contentEncrypted: string;
  contentIv: string;
  receivedAt: number;
  messageHash: string;
}

/** Call event payload (from Android) */
export interface WSCallPayload {
  caller: string;
  callerName: string | null;
  status: string;
  startedAt: number;
  answeredAt: number | null;
  endedAt: number | null;
}

/** Notification event payload (from Android) */
export interface WSNotificationPayload {
  packageName: string;
  appName: string;
  title: string;
  contentEncrypted: string;
  contentIv: string;
  postedAt: number;
  contentHash: string;
}

/** Error payload from server */
export interface WSErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/** Heartbeat payload */
export interface WSHeartbeatPayload {
  uptime: number;
  queueSize: number;
}

/** Create a typed WebSocket message */
export function createWSMessage<T>(
  type: WSMessageType,
  payload: T,
  id?: string
): WSMessage<T> {
  return {
    type,
    id: id ?? generateMessageId(),
    timestamp: Date.now(),
    payload,
  };
}

/** Generate a unique message ID */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

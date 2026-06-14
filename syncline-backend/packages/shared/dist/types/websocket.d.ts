import { EventType } from './events';
/** WebSocket message types for the sync protocol */
export declare enum WSMessageType {
    AUTH = "auth",
    SMS_EVENT = "sms_event",
    CALL_EVENT = "call_event",
    NOTIFICATION_EVENT = "notification_event",
    ACK = "ack",
    HEARTBEAT_PING = "heartbeat_ping",
    AUTH_OK = "auth_ok",
    AUTH_FAIL = "auth_fail",
    SMS_RECEIVED = "sms_received",
    CALL_RECEIVED = "call_received",
    NOTIFICATION_RECEIVED = "notification_received",
    EVENT_ACK = "event_ack",
    HEARTBEAT_PONG = "heartbeat_pong",
    ERROR = "error",
    OFFLINE_FLUSH = "offline_flush",
    OFFLINE_EVENT = "offline_event"
}
/** Base WebSocket message structure */
export interface WSMessage<T = unknown> {
    type: WSMessageType;
    id: string;
    timestamp: number;
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
export declare function createWSMessage<T>(type: WSMessageType, payload: T, id?: string): WSMessage<T>;
//# sourceMappingURL=websocket.d.ts.map
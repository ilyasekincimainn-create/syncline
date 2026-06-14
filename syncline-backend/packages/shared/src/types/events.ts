/** SMS event captured from Android device */
export interface SmsEvent {
  id: string;
  userId: string;
  sender: string;
  contentEncrypted: string;
  contentIv: string;
  receivedAt: Date;
  deliveredAt: Date | null;
  messageHash: string;
}

/** Call status transitions */
export enum CallStatus {
  RINGING = 'ringing',
  ANSWERED = 'answered',
  ENDED = 'ended',
  MISSED = 'missed',
  REJECTED = 'rejected',
}

/** Call event captured from Android device */
export interface CallEvent {
  id: string;
  userId: string;
  caller: string;
  callerName: string | null;
  status: CallStatus;
  startedAt: Date;
  answeredAt: Date | null;
  endedAt: Date | null;
  durationSec: number | null;
}

/** Notification event mirrored from Android */
export interface NotificationEvent {
  id: string;
  userId: string;
  packageName: string;
  appName: string;
  title: string;
  contentEncrypted: string;
  contentIv: string;
  postedAt: Date;
  contentHash: string;
}

/** Offline queue entry for undelivered events */
export interface OfflineQueueEntry {
  id: string;
  userId: string;
  eventType: EventType;
  payloadEncrypted: string;
  payloadIv: string;
  createdAt: Date;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt: Date | null;
}

/** Event types for routing and queue management */
export enum EventType {
  SMS = 'sms',
  CALL = 'call',
  NOTIFICATION = 'notification',
  CALL_WEBRTC = 'call_webrtc',
}

/** Generic event wrapper for Redis Streams */
export interface StreamEvent {
  id: string;
  userId: string;
  type: EventType;
  payload: string;
  timestamp: number;
  sourceDeviceId: string;
  targetDeviceId: string;
}

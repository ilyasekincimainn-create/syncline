import { WSMessage, WSMessageType, createWSMessage } from '../types/websocket';

export const MessageFactory = {
  auth(accessToken: string, deviceId: string): WSMessage {
    return createWSMessage(WSMessageType.AUTH, { accessToken, deviceId });
  },

  authOk(details: { paired: boolean; pairedDeviceId?: string }): WSMessage {
    return createWSMessage(WSMessageType.AUTH_OK, details);
  },

  authFail(reason: string): WSMessage {
    return createWSMessage(WSMessageType.AUTH_FAIL, { reason });
  },

  heartbeatPing(uptime: number, queueSize: number): WSMessage {
    return createWSMessage(WSMessageType.HEARTBEAT_PING, { uptime, queueSize });
  },

  heartbeatPong(): WSMessage {
    return createWSMessage(WSMessageType.HEARTBEAT_PONG, {});
  },

  error(code: string, message: string, details?: Record<string, unknown>): WSMessage {
    return createWSMessage(WSMessageType.ERROR, { code, message, details });
  },

  smsEvent(event: {
    sender: string;
    contentEncrypted: string;
    contentIv: string;
    receivedAt: number;
    messageHash: string;
  }, id?: string): WSMessage {
    return createWSMessage(WSMessageType.SMS_EVENT, event, id);
  },

  smsReceived(event: {
    id: string;
    sender: string;
    contentEncrypted: string;
    contentIv: string;
    receivedAt: number;
  }): WSMessage {
    return createWSMessage(WSMessageType.SMS_RECEIVED, event);
  },

  callEvent(event: {
    caller: string;
    callerName: string | null;
    status: string;
    startedAt: number;
    answeredAt: number | null;
    endedAt: number | null;
  }, id?: string): WSMessage {
    return createWSMessage(WSMessageType.CALL_EVENT, event, id);
  },

  callReceived(event: {
    id: string;
    caller: string;
    callerName: string | null;
    status: string;
    startedAt: number;
    answeredAt: number | null;
    endedAt: number | null;
  }): WSMessage {
    return createWSMessage(WSMessageType.CALL_RECEIVED, event);
  },

  notificationEvent(event: {
    packageName: string;
    appName: string;
    title: string;
    contentEncrypted: string;
    contentIv: string;
    postedAt: number;
    contentHash: string;
  }, id?: string): WSMessage {
    return createWSMessage(WSMessageType.NOTIFICATION_EVENT, event, id);
  },

  notificationReceived(event: {
    id: string;
    packageName: string;
    appName: string;
    title: string;
    contentEncrypted: string;
    contentIv: string;
    postedAt: number;
  }): WSMessage {
    return createWSMessage(WSMessageType.NOTIFICATION_RECEIVED, event);
  },

  ack(eventId: string, eventType: string, id?: string): WSMessage {
    return createWSMessage(WSMessageType.ACK, { eventId, eventType }, id);
  },

  eventAck(eventId: string, status: 'delivered' | 'queued'): WSMessage {
    return createWSMessage(WSMessageType.EVENT_ACK, { eventId, status });
  },

  offlineFlush(events: Array<WSMessage>): WSMessage {
    return createWSMessage(WSMessageType.OFFLINE_FLUSH, { events });
  }
};

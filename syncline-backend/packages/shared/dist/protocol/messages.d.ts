import { WSMessage } from '../types/websocket';
export declare const MessageFactory: {
    auth(accessToken: string, deviceId: string): WSMessage;
    authOk(details: {
        paired: boolean;
        pairedDeviceId?: string;
    }): WSMessage;
    authFail(reason: string): WSMessage;
    heartbeatPing(uptime: number, queueSize: number): WSMessage;
    heartbeatPong(): WSMessage;
    error(code: string, message: string, details?: Record<string, unknown>): WSMessage;
    smsEvent(event: {
        sender: string;
        contentEncrypted: string;
        contentIv: string;
        receivedAt: number;
        messageHash: string;
    }, id?: string): WSMessage;
    smsReceived(event: {
        id: string;
        sender: string;
        contentEncrypted: string;
        contentIv: string;
        receivedAt: number;
    }): WSMessage;
    callEvent(event: {
        caller: string;
        callerName: string | null;
        status: string;
        startedAt: number;
        answeredAt: number | null;
        endedAt: number | null;
    }, id?: string): WSMessage;
    callReceived(event: {
        id: string;
        caller: string;
        callerName: string | null;
        status: string;
        startedAt: number;
        answeredAt: number | null;
        endedAt: number | null;
    }): WSMessage;
    notificationEvent(event: {
        packageName: string;
        appName: string;
        title: string;
        contentEncrypted: string;
        contentIv: string;
        postedAt: number;
        contentHash: string;
    }, id?: string): WSMessage;
    notificationReceived(event: {
        id: string;
        packageName: string;
        appName: string;
        title: string;
        contentEncrypted: string;
        contentIv: string;
        postedAt: number;
    }): WSMessage;
    ack(eventId: string, eventType: string, id?: string): WSMessage;
    eventAck(eventId: string, status: "delivered" | "queued"): WSMessage;
    offlineFlush(events: Array<WSMessage>): WSMessage;
};
//# sourceMappingURL=messages.d.ts.map
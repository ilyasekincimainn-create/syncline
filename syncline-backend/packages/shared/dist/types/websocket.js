"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WSMessageType = void 0;
exports.createWSMessage = createWSMessage;
/** WebSocket message types for the sync protocol */
var WSMessageType;
(function (WSMessageType) {
    // Client → Server
    WSMessageType["AUTH"] = "auth";
    WSMessageType["SMS_EVENT"] = "sms_event";
    WSMessageType["CALL_EVENT"] = "call_event";
    WSMessageType["NOTIFICATION_EVENT"] = "notification_event";
    WSMessageType["ACK"] = "ack";
    WSMessageType["HEARTBEAT_PING"] = "heartbeat_ping";
    // Server → Client
    WSMessageType["AUTH_OK"] = "auth_ok";
    WSMessageType["AUTH_FAIL"] = "auth_fail";
    WSMessageType["SMS_RECEIVED"] = "sms_received";
    WSMessageType["CALL_RECEIVED"] = "call_received";
    WSMessageType["NOTIFICATION_RECEIVED"] = "notification_received";
    WSMessageType["EVENT_ACK"] = "event_ack";
    WSMessageType["HEARTBEAT_PONG"] = "heartbeat_pong";
    WSMessageType["ERROR"] = "error";
    // Offline queue
    WSMessageType["OFFLINE_FLUSH"] = "offline_flush";
    WSMessageType["OFFLINE_EVENT"] = "offline_event";
})(WSMessageType || (exports.WSMessageType = WSMessageType = {}));
/** Create a typed WebSocket message */
function createWSMessage(type, payload, id) {
    return {
        type,
        id: id ?? generateMessageId(),
        timestamp: Date.now(),
        payload,
    };
}
/** Generate a unique message ID */
function generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
//# sourceMappingURL=websocket.js.map
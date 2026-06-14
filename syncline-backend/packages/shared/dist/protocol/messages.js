"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageFactory = void 0;
const websocket_1 = require("../types/websocket");
exports.MessageFactory = {
    auth(accessToken, deviceId) {
        return (0, websocket_1.createWSMessage)(websocket_1.WSMessageType.AUTH, { accessToken, deviceId });
    },
    authOk(details) {
        return (0, websocket_1.createWSMessage)(websocket_1.WSMessageType.AUTH_OK, details);
    },
    authFail(reason) {
        return (0, websocket_1.createWSMessage)(websocket_1.WSMessageType.AUTH_FAIL, { reason });
    },
    heartbeatPing(uptime, queueSize) {
        return (0, websocket_1.createWSMessage)(websocket_1.WSMessageType.HEARTBEAT_PING, { uptime, queueSize });
    },
    heartbeatPong() {
        return (0, websocket_1.createWSMessage)(websocket_1.WSMessageType.HEARTBEAT_PONG, {});
    },
    error(code, message, details) {
        return (0, websocket_1.createWSMessage)(websocket_1.WSMessageType.ERROR, { code, message, details });
    },
    smsEvent(event, id) {
        return (0, websocket_1.createWSMessage)(websocket_1.WSMessageType.SMS_EVENT, event, id);
    },
    smsReceived(event) {
        return (0, websocket_1.createWSMessage)(websocket_1.WSMessageType.SMS_RECEIVED, event);
    },
    callEvent(event, id) {
        return (0, websocket_1.createWSMessage)(websocket_1.WSMessageType.CALL_EVENT, event, id);
    },
    callReceived(event) {
        return (0, websocket_1.createWSMessage)(websocket_1.WSMessageType.CALL_RECEIVED, event);
    },
    notificationEvent(event, id) {
        return (0, websocket_1.createWSMessage)(websocket_1.WSMessageType.NOTIFICATION_EVENT, event, id);
    },
    notificationReceived(event) {
        return (0, websocket_1.createWSMessage)(websocket_1.WSMessageType.NOTIFICATION_RECEIVED, event);
    },
    ack(eventId, eventType, id) {
        return (0, websocket_1.createWSMessage)(websocket_1.WSMessageType.ACK, { eventId, eventType }, id);
    },
    eventAck(eventId, status) {
        return (0, websocket_1.createWSMessage)(websocket_1.WSMessageType.EVENT_ACK, { eventId, status });
    },
    offlineFlush(events) {
        return (0, websocket_1.createWSMessage)(websocket_1.WSMessageType.OFFLINE_FLUSH, { events });
    }
};
//# sourceMappingURL=messages.js.map
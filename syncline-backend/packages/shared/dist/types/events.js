"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventType = exports.CallStatus = void 0;
/** Call status transitions */
var CallStatus;
(function (CallStatus) {
    CallStatus["RINGING"] = "ringing";
    CallStatus["ANSWERED"] = "answered";
    CallStatus["ENDED"] = "ended";
    CallStatus["MISSED"] = "missed";
    CallStatus["REJECTED"] = "rejected";
})(CallStatus || (exports.CallStatus = CallStatus = {}));
/** Event types for routing and queue management */
var EventType;
(function (EventType) {
    EventType["SMS"] = "sms";
    EventType["CALL"] = "call";
    EventType["NOTIFICATION"] = "notification";
    EventType["CALL_WEBRTC"] = "call_webrtc";
})(EventType || (exports.EventType = EventType = {}));
//# sourceMappingURL=events.js.map
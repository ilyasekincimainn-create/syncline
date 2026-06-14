"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignalingMessageType = void 0;
var SignalingMessageType;
(function (SignalingMessageType) {
    SignalingMessageType["OFFER"] = "offer";
    SignalingMessageType["ANSWER"] = "answer";
    SignalingMessageType["ICE_CANDIDATE"] = "ice_candidate";
    SignalingMessageType["CALL_ACCEPT"] = "call_accept";
    SignalingMessageType["CALL_REJECT"] = "call_reject";
    SignalingMessageType["CALL_HANGUP"] = "call_hangup";
    SignalingMessageType["CALL_BUSY"] = "call_busy";
    SignalingMessageType["SIGNALING_ERROR"] = "signaling_error";
})(SignalingMessageType || (exports.SignalingMessageType = SignalingMessageType = {}));
//# sourceMappingURL=webrtc.js.map
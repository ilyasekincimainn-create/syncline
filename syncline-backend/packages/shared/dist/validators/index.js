"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateWSMessage = validateWSMessage;
exports.isValidPairingCode = isValidPairingCode;
exports.isValidUuid = isValidUuid;
const websocket_1 = require("../types/websocket");
function validateWSMessage(msg) {
    if (typeof msg !== 'object' || msg === null)
        return false;
    const m = msg;
    if (typeof m.type !== 'string' || !Object.values(websocket_1.WSMessageType).includes(m.type)) {
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
function isValidPairingCode(code) {
    return /^\d{6}$/.test(code);
}
function isValidUuid(uuid) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
}
//# sourceMappingURL=index.js.map
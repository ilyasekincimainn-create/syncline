"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorDescriptions = exports.SyncLineErrorCode = void 0;
var SyncLineErrorCode;
(function (SyncLineErrorCode) {
    SyncLineErrorCode["UNAUTHORIZED"] = "ERR_UNAUTHORIZED";
    SyncLineErrorCode["BAD_REQUEST"] = "ERR_BAD_REQUEST";
    SyncLineErrorCode["INTERNAL_ERROR"] = "ERR_INTERNAL_ERROR";
    SyncLineErrorCode["DEVICE_NOT_FOUND"] = "ERR_DEVICE_NOT_FOUND";
    SyncLineErrorCode["PAIRING_EXPIRED"] = "ERR_PAIRING_EXPIRED";
    SyncLineErrorCode["PAIRING_INVALID"] = "ERR_PAIRING_INVALID";
    SyncLineErrorCode["DUPLICATE_EVENT"] = "ERR_DUPLICATE_EVENT";
    SyncLineErrorCode["SERVICE_UNAVAILABLE"] = "ERR_SERVICE_UNAVAILABLE";
    SyncLineErrorCode["RATE_LIMIT_EXCEEDED"] = "ERR_RATE_LIMIT_EXCEEDED";
    SyncLineErrorCode["SESSION_CLOSED"] = "ERR_SESSION_CLOSED";
})(SyncLineErrorCode || (exports.SyncLineErrorCode = SyncLineErrorCode = {}));
exports.ErrorDescriptions = {
    [SyncLineErrorCode.UNAUTHORIZED]: 'Invalid or expired credentials provided.',
    [SyncLineErrorCode.BAD_REQUEST]: 'The request structure or values are invalid.',
    [SyncLineErrorCode.INTERNAL_ERROR]: 'An internal server error occurred.',
    [SyncLineErrorCode.DEVICE_NOT_FOUND]: 'Target device or paired user cannot be found.',
    [SyncLineErrorCode.PAIRING_EXPIRED]: 'Pairing session has expired.',
    [SyncLineErrorCode.PAIRING_INVALID]: 'Pairing code is incorrect or already used.',
    [SyncLineErrorCode.DUPLICATE_EVENT]: 'This event was already processed.',
    [SyncLineErrorCode.SERVICE_UNAVAILABLE]: 'Downstream service is currently unavailable.',
    [SyncLineErrorCode.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded, please slow down.',
    [SyncLineErrorCode.SESSION_CLOSED]: 'Signaling session was closed due to timeout or hangup.',
};
//# sourceMappingURL=errors.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionState = exports.Platform = void 0;
/** Platform type for connected devices */
var Platform;
(function (Platform) {
    Platform["ANDROID"] = "android";
    Platform["IOS"] = "ios";
})(Platform || (exports.Platform = Platform = {}));
/** Device connection state */
var ConnectionState;
(function (ConnectionState) {
    ConnectionState["CONNECTED"] = "connected";
    ConnectionState["DISCONNECTED"] = "disconnected";
    ConnectionState["RECONNECTING"] = "reconnecting";
})(ConnectionState || (exports.ConnectionState = ConnectionState = {}));
//# sourceMappingURL=device.js.map
/** Platform type for connected devices */
export declare enum Platform {
    ANDROID = "android",
    IOS = "ios"
}
/** Device registration payload sent during initial setup */
export interface DeviceRegistration {
    uuid: string;
    fingerprint: string;
    platform: Platform;
    pushToken: string;
    model: string;
    osVersion: string;
}
/** Stored device record in the database */
export interface Device {
    id: string;
    uuid: string;
    platform: Platform;
    fingerprint: string;
    pushToken: string;
    model: string;
    osVersion: string;
    createdAt: Date;
    lastSeen: Date;
}
/** Pairing code used to link Android ↔ iOS devices */
export interface PairingCode {
    code: string;
    deviceId: string;
    expiresAt: Date;
    used: boolean;
}
/** A paired user linking two devices */
export interface User {
    id: string;
    androidDeviceId: string;
    iosDeviceId: string | null;
    pairCode: string;
    pairedAt: Date | null;
    createdAt: Date;
}
/** Device connection state */
export declare enum ConnectionState {
    CONNECTED = "connected",
    DISCONNECTED = "disconnected",
    RECONNECTING = "reconnecting"
}
/** Device info summary for client display */
export interface DeviceInfo {
    id: string;
    platform: Platform;
    model: string;
    osVersion: string;
    connectionState: ConnectionState;
    lastSeen: Date;
}
//# sourceMappingURL=device.d.ts.map
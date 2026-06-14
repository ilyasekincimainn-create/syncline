export declare function initFcm(): void;
/**
 * Sends a push notification/data payload to an Android device via FCM
 * @param token Android device push token
 * @param eventType type of event
 * @param payload event JSON payload
 */
export declare function sendFcmNotification(token: string, eventType: string, payload: any): Promise<boolean>;
//# sourceMappingURL=fcm.d.ts.map
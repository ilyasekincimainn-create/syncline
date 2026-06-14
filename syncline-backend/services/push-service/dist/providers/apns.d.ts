export declare function initApns(): void;
/**
 * Sends a notification via APNs
 * @param deviceToken target iOS device push token
 * @param eventType type of event
 * @param payload event JSON payload
 * @param isVoip whether to send a VoIP push (PushKit)
 */
export declare function sendApnsNotification(deviceToken: string, eventType: string, payload: any, isVoip: boolean): Promise<boolean>;
//# sourceMappingURL=apns.d.ts.map
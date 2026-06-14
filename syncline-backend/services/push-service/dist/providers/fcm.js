"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initFcm = initFcm;
exports.sendFcmNotification = sendFcmNotification;
const admin = __importStar(require("firebase-admin"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let fcmInitialized = false;
function initFcm() {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.join(__dirname, '../../keys/firebase-service-account.json');
    if (!fs.existsSync(serviceAccountPath)) {
        console.warn(`Firebase service account file not found at ${serviceAccountPath}. FCM will be stubbed.`);
        return;
    }
    try {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        fcmInitialized = true;
        console.log('FCM provider successfully initialized.');
    }
    catch (err) {
        console.error('Failed to initialize FCM admin SDK:', err);
    }
}
/**
 * Sends a push notification/data payload to an Android device via FCM
 * @param token Android device push token
 * @param eventType type of event
 * @param payload event JSON payload
 */
async function sendFcmNotification(token, eventType, payload) {
    if (!fcmInitialized) {
        console.log(`[STUB FCM] Send push to ${token}:`, { eventType, payload });
        return true; // Return success for dev stubbing
    }
    const message = {
        token: token,
        // Use data message (no alert notification block) to handle custom UI rendering and background sync in Android
        data: {
            eventType,
            payload: JSON.stringify(payload),
        },
        android: {
            priority: 'high',
            ttl: 0, // Deliver immediately
        },
    };
    try {
        const response = await admin.messaging().send(message);
        console.log('Successfully sent FCM message:', response);
        return true;
    }
    catch (err) {
        console.error('Error sending FCM message:', err);
        return false;
    }
}
//# sourceMappingURL=fcm.js.map
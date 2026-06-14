import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

let fcmInitialized = false;

export function initFcm() {
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
  } catch (err) {
    console.error('Failed to initialize FCM admin SDK:', err);
  }
}

/**
 * Sends a push notification/data payload to an Android device via FCM
 * @param token Android device push token
 * @param eventType type of event
 * @param payload event JSON payload
 */
export async function sendFcmNotification(
  token: string,
  eventType: string,
  payload: any
): Promise<boolean> {
  if (!fcmInitialized) {
    console.log(`[STUB FCM] Send push to ${token}:`, { eventType, payload });
    return true; // Return success for dev stubbing
  }

  const message: admin.messaging.Message = {
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
  } catch (err) {
    console.error('Error sending FCM message:', err);
    return false;
  }
}

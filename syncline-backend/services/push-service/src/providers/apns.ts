import * as apn from '@parse/node-apn';
import * as fs from 'fs';
import * as path from 'path';

let apnProvider: apn.Provider | null = null;

export function initApns() {
  const teamId = process.env.APNS_TEAM_ID;
  const keyId = process.env.APNS_KEY_ID;
  const keyPath = process.env.APNS_KEY_PATH || path.join(__dirname, '../../keys/apns.p8');
  
  if (!teamId || !keyId) {
    console.warn('APNs credentials missing (APNS_TEAM_ID, APNS_KEY_ID). APNs notifications will be stubs.');
    return;
  }

  try {
    if (!fs.existsSync(keyPath)) {
      console.warn(`APNs key file not found at ${keyPath}. APNs notifications will be stubs.`);
      return;
    }

    apnProvider = new apn.Provider({
      token: {
        key: keyPath,
        keyId: keyId,
        teamId: teamId,
      },
      production: process.env.NODE_ENV === 'production',
    });
    console.log('APNs provider successfully initialized.');
  } catch (err) {
    console.error('Failed to initialize APNs provider:', err);
  }
}

/**
 * Sends a notification via APNs
 * @param deviceToken target iOS device push token
 * @param eventType type of event
 * @param payload event JSON payload
 * @param isVoip whether to send a VoIP push (PushKit)
 */
export async function sendApnsNotification(
  deviceToken: string,
  eventType: string,
  payload: any,
  isVoip: boolean
): Promise<boolean> {
  if (!apnProvider) {
    console.log(`[STUB APNS] Send ${isVoip ? 'VoIP' : 'Standard'} push to ${deviceToken}:`, payload);
    return true; // Return success for dev stubbing
  }

  const notification = new apn.Notification();
  
  // Apple bundle ID, typically "com.syncline.companion"
  // For VoIP pushes, iOS requires the ".voip" suffix in the topic for VoIP entitlements
  const bundleId = process.env.APNS_BUNDLE_ID || 'com.syncline.companion';
  notification.topic = isVoip ? `${bundleId}.voip` : bundleId;
  
  if (isVoip) {
    // VoIP pushes must be silent background pushes that wake up PushKit.
    // Must contain raw payload with call details
    notification.rawPayload = {
      aps: {
        'content-available': 1,
      },
      eventType,
      payload,
    };
    // VoIP calls must have high priority
    notification.priority = 10;
    // Set expiration to 0 so it doesn't linger if offline
    notification.expiry = 0;
  } else {
    // Standard alert push for SMS/Notifications
    notification.expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour
    notification.badge = 1;
    notification.sound = 'default';
    notification.alert = getAlertBody(eventType, payload);
    notification.payload = { eventType, payload };
    notification.priority = 10;
  }

  try {
    const response = await apnProvider.send(notification, deviceToken);
    
    if (response.failed.length > 0) {
      console.error('APNs send failed:', response.failed[0]);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('APNs delivery error:', err);
    return false;
  }
}

function getAlertBody(eventType: string, payload: any): string {
  if (eventType === 'sms') {
    return `New SMS from ${payload.sender || 'Unknown'}`;
  }
  if (eventType === 'call') {
    return `Missed Call from ${payload.caller || 'Unknown'}`;
  }
  return 'New SyncLine updates available';
}

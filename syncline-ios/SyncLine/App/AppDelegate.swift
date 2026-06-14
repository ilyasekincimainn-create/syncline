import UIKit
import PushKit
import CallKit

class AppDelegate: NSObject, UIApplicationDelegate, PKPushRegistryDelegate {
    
    private var pushRegistry: PKPushRegistry?
    
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        setupVoIPPush()
        return true
    }
    
    private func setupVoIPPush() {
        // Register for VoIP Push notifications using PushKit
        pushRegistry = PKPushRegistry(queue: DispatchQueue.main)
        pushRegistry?.delegate = self
        pushRegistry?.desiredPushTypes = [.voIP]
        print("VoIP push registration initiated.")
    }
    
    // MARK: - PKPushRegistryDelegate
    
    func pushRegistry(
        _ registry: PKPushRegistry,
        didUpdate pushCredentials: PKPushCredentials,
        for type: PKPushType
    ) {
        let token = pushCredentials.pushToken.map { String(format: "%02.2hhx", $0) }.joined()
        print("VoIP Push Token: \(token)")
        // Share this token with the backend so it can target VoIP pushes here.
        UserDefaults.standard.set(token, forKey: "apns_voip_token")
    }
    
    func pushRegistry(
        _ registry: PKPushRegistry,
        didReceiveIncomingPushWith payload: PKPushPayload,
        for type: PKPushType,
        completion: @escaping () -> Void
    ) {
        print("VoIP Push received: \(payload.dictionaryPayload)")
        
        // Extract call parameters
        let eventPayload = payload.dictionaryPayload["payload"] as? [String: Any] ?? [:]
        let caller = eventPayload["caller"] as? String ?? "Bilinmeyen Numara"
        let callIdString = eventPayload["id"] as? String ?? UUID().uuidString
        let callUUID = UUID(uuidString: callIdString) ?? UUID()
        
        // Report call directly to CallKit within 10s Apple constraint
        CallKitManager.shared.reportIncomingCall(uuid: callUUID, handle: caller) {
            completion()
        }
    }
    
    func pushRegistry(
        _ registry: PKPushRegistry,
        didInvalidatePushTokenFor type: PKPushType
    ) {
        print("VoIP Push token invalidated.")
    }
}

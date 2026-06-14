import Foundation
import PushKit
import Combine

class PushKitHandler: NSObject, ObservableObject {
    
    static let shared = PushKitHandler()
    
    @Published var pushToken: String?
    
    private override init() {
        super.init()
        if let cachedToken = UserDefaults.standard.string(forKey: "apns_voip_token") {
            self.pushToken = cachedToken
        }
    }
    
    func handleTokenUpdate(_ token: String) {
        self.pushToken = token
        UserDefaults.standard.set(token, forKey: "apns_voip_token")
        
        // Report token to server if paired
        uploadTokenToServer(token)
    }
    
    func uploadTokenToServer(_ token: String) {
        guard let uuid = KeychainHelper.shared.read(service: "syncline", account: "device_id"),
              let fingerprint = KeychainHelper.shared.read(service: "syncline", account: "device_fingerprint") else {
            return
        }
        
        let model = UIDevice.current.model
        let osVersion = UIDevice.current.systemVersion
        
        APIClient.shared.registerDevice(
            uuid: uuid,
            fingerprint: fingerprint,
            pushToken: token,
            model: model,
            osVersion: osVersion
        ) { result in
            switch result {
            case .success(let response):
                print("Push token updated on server: \(response)")
            case .failure(let error):
                print("Failed to update push token on server: \(error.localizedDescription)")
            }
        }
    }
}

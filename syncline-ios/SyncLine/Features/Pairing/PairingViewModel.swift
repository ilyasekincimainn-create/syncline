import Foundation
import Combine
import UIKit

class PairingViewModel: ObservableObject {
    
    @Published var isPairing = false
    @Published var pairingError: String? = nil
    @Published var isPaired = false
    
    init() {
        checkPairingStatus()
    }
    
    func checkPairingStatus() {
        let pairedId = KeychainHelper.shared.read(service: "syncline", account: "paired_device_id")
        self.isPaired = (pairedId != nil)
    }
    
    func registerDeviceAndFetchCredentials(completion: @escaping () -> Void) {
        let keychain = KeychainHelper.shared
        
        // Ensure device registration IDs exist
        let uuid: String
        let fingerprint: String
        
        if let existingUuid = keychain.read(service: "syncline", account: "device_id"),
           let existingFingerprint = keychain.read(service: "syncline", account: "device_fingerprint") {
            uuid = existingUuid
            fingerprint = existingFingerprint
        } else {
            uuid = UUID().uuidString
            fingerprint = Data(SHA256.hash(data: uuid.data(using: .utf8)!)).map { String(format: "%02hhx", $0) }.joined()
            keychain.save(uuid, service: "syncline", account: "device_id")
            keychain.save(fingerprint, service: "syncline", account: "device_fingerprint")
        }
        
        let pushToken = UserDefaults.standard.string(forKey: "apns_voip_token") ?? "apns_mock_token_for_simulator"
        
        let registerUrl = APIClient.shared.baseURL.appendingPathComponent("api/auth/register").absoluteString
        print("Register request initiating to URL: \(registerUrl)")
        
        APIClient.shared.registerDevice(
            uuid: uuid,
            fingerprint: fingerprint,
            pushToken: pushToken,
            model: UIDevice.current.model,
            osVersion: UIDevice.current.systemVersion
        ) { result in
            DispatchQueue.main.async {
                switch result {
                case .success(let response):
                    print("Registration succeeded: \(response)")
                    if let token = response["accessToken"] as? String {
                        keychain.save(token, service: "syncline", account: "access_token")
                    }
                    completion()
                case .failure(let error):
                    print("Registration failed: \(error.localizedDescription)")
                    completion()
                }
            }
        }
    }
    
    func pair(with code: String) {
        self.isPairing = true
        self.pairingError = nil
        
        registerDeviceAndFetchCredentials { [weak self] in
            guard let self = self else { return }
            
            let pairUrl = APIClient.shared.baseURL.appendingPathComponent("api/auth/pair").absoluteString
            print("Pairing request initiating to URL: \(pairUrl)")
            
            APIClient.shared.pairDevice(code: code) { result in
                DispatchQueue.main.async {
                    self.isPairing = false
                    switch result {
                    case .success(let response):
                        print("Pairing response: \(response)")
                        
                        let pairedId = (response["androidDeviceId"] as? String) ?? (response["deviceId"] as? String)
                        
                        if let pairedId = pairedId {
                            KeychainHelper.shared.save(pairedId, service: "syncline", account: "paired_device_id")
                            
                            // Save the new access token returned by pairing
                            if let tokens = response["tokens"] as? [String: Any],
                               let accessToken = tokens["accessToken"] as? String {
                                KeychainHelper.shared.save(accessToken, service: "syncline", account: "access_token")
                                print("Pairing access token updated in Keychain.")
                            }
                            
                            // Check if symmetric key was returned (common in key exchange protocols)
                            if let symKey = response["symmetricKey"] as? String {
                                CryptoManager.shared.setSymmetricKey(symKey)
                            }
                            
                            // Store details
                            self.isPaired = true
                            
                            // Reconnect socket with new session details
                            WebSocketManager.shared.disconnect()
                            WebSocketManager.shared.connect()
                        } else if let payload = response["payload"] as? [String: Any],
                                  let pairedId = (payload["androidDeviceId"] as? String) ?? (payload["deviceId"] as? String) {
                            // Backup payload check
                            KeychainHelper.shared.save(pairedId, service: "syncline", account: "paired_device_id")
                            
                            if let tokens = payload["tokens"] as? [String: Any],
                               let accessToken = tokens["accessToken"] as? String {
                                KeychainHelper.shared.save(accessToken, service: "syncline", account: "access_token")
                            } else if let tokens = response["tokens"] as? [String: Any],
                                      let accessToken = tokens["accessToken"] as? String {
                                KeychainHelper.shared.save(accessToken, service: "syncline", account: "access_token")
                            }
                            
                            if let symKey = payload["symmetricKey"] as? String {
                                CryptoManager.shared.setSymmetricKey(symKey)
                            }
                            self.isPaired = true
                            
                            WebSocketManager.shared.disconnect()
                            WebSocketManager.shared.connect()
                        } else {
                            self.pairingError = "Pairing Response is missing device identifiers."
                        }
                    case .failure(let error):
                        let pairUrl = APIClient.shared.baseURL.appendingPathComponent("api/auth/pair").absoluteString
                        self.pairingError = "Could not connect to the server: [\(pairUrl)] \(error.localizedDescription)"
                    }
                }
            }
        }
    }
    
    func unpair() {
        KeychainHelper.shared.delete(service: "syncline", account: "paired_device_id")
        KeychainHelper.shared.delete(service: "syncline", account: "access_token")
        self.isPaired = false
        WebSocketManager.shared.disconnect()
    }
}

// Simple helper import of CryptoKit hash since it is required in instruction but standard
import CryptoKit

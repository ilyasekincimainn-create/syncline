import Foundation
import Combine
import UIKit

class SettingsViewModel: ObservableObject {
    
    @Published var isConnected = false
    @Published var isPaired = false
    @Published var deviceId = ""
    @Published var pairedDeviceId = ""
    @Published var encryptionKeyStatus = "Anahtar Oluşturulmadı"
    @Published var apnsToken = "Alınmadı"
    
    private var cancellables = Set<AnyCancellable>()
    
    init() {
        refreshState()
        setupWebSocketObservers()
    }
    
    func refreshState() {
        self.deviceId = KeychainHelper.shared.read(service: "syncline", account: "device_id") ?? "Bilinmiyor"
        self.pairedDeviceId = KeychainHelper.shared.read(service: "syncline", account: "paired_device_id") ?? "Eşleştirilmedi"
        self.isPaired = (pairedDeviceId != "Eşleştirilmedi")
        
        let hasKey = KeychainHelper.shared.read(service: "syncline", account: "aes_key") != nil
        self.encryptionKeyStatus = hasKey ? "E2E Aktif (256-bit AES-GCM)" : "Anahtar Yok"
        
        self.apnsToken = UserDefaults.standard.string(forKey: "apns_device_token") ?? "Alınmadı"
        self.isConnected = WebSocketManager.shared.connectionPublisher.value
    }
    
    private func setupWebSocketObservers() {
        WebSocketManager.shared.connectionPublisher
            .receive(on: DispatchQueue.main)
            .assign(to: \.isConnected, on: self)
            .store(in: &cancellables)
    }
    
    func unpairDevice() {
        // Clear pairing credentials and access token
        KeychainHelper.shared.delete(service: "syncline", account: "access_token")
        KeychainHelper.shared.delete(service: "syncline", account: "paired_device_id")
        KeychainHelper.shared.delete(service: "syncline", account: "aes_key")
        
        // Clear message and call cache
        UserDefaults.standard.removeObject(forKey: "cached_sms_messages")
        UserDefaults.standard.removeObject(forKey: "cached_call_logs")
        
        // Disconnect socket
        WebSocketManager.shared.disconnect()
        
        // Post notification so dashboard updates
        NotificationCenter.default.post(name: Notification.Name("DevicePairingStateChanged"), object: nil)
        
        refreshState()
    }
    
    func regenerateKeys() {
        // In a real application, you'd perform DH or re-exchange
        let randomKey = Data((0..<32).map { _ in UInt8.random(in: 0...255) })
        let base64Key = randomKey.base64EncodedString()
        KeychainHelper.shared.save(base64Key, service: "syncline", account: "aes_key")
        refreshState()
    }
}

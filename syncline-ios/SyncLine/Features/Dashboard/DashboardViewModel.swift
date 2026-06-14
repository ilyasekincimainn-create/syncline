import Foundation
import Combine
import UIKit

class DashboardViewModel: ObservableObject {
    
    @Published var isPaired = false
    @Published var isConnected = false
    @Published var pairedDeviceName = "Cihaz Eşleştirilmedi"
    @Published var totalSmsCount = 0
    @Published var totalCallsCount = 0
    @Published var callLogs: [CallEvent] = []
    
    private var cancellables = Set<AnyCancellable>()
    private let callCacheKey = "cached_call_logs"
    
    init() {
        checkPairingStatus()
        loadCachedCalls()
        setupStatusObservers()
        setupWebSocketObservers()
        
        // Auto connect WebSocket if token exists
        if KeychainHelper.shared.read(service: "syncline", account: "access_token") != nil {
            WebSocketManager.shared.connect()
        }
    }
    
    func checkPairingStatus() {
        let pairedId = KeychainHelper.shared.read(service: "syncline", account: "paired_device_id")
        self.isPaired = (pairedId != nil)
        self.pairedDeviceName = pairedId ?? "Cihaz Eşleştirilmedi"
        updateCounts()
    }
    
    private func setupStatusObservers() {
        WebSocketManager.shared.connectionPublisher
            .receive(on: DispatchQueue.main)
            .assign(to: \.isConnected, on: self)
            .store(in: &cancellables)
    }
    
    private func setupWebSocketObservers() {
        WebSocketManager.shared.messagePublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] jsonString in
                self?.handleWebSocketMessage(jsonString)
            }
            .store(in: &cancellables)
    }
    
    private func handleWebSocketMessage(_ jsonString: String) {
        guard let data = jsonString.data(using: .utf8),
              let message = try? JSONDecoder().decode(WSMessage.self) else {
            return
        }
        
        if message.type == "sync_call", let incomingCalls = message.payload.calls {
            mergeIncomingCalls(incomingCalls)
        }
    }
    
    private func mergeIncomingCalls(_ newCalls: [CallEvent]) {
        var currentMap = Dictionary(uniqueKeysWithValues: callLogs.map { ($0.id, $0) })
        for call in newCalls {
            currentMap[call.id] = call
        }
        self.callLogs = Array(currentMap.values).sorted(by: { $0.timestamp > $1.timestamp })
        saveCallsToCache()
        updateCounts()
    }
    
    func syncNow() {
        guard isConnected else { return }
        
        let syncMsg = WSMessage(
            type: "sync_request",
            id: "sync_req_\(Int(Date().timeIntervalSince1970))",
            timestamp: Int(Date().timeIntervalSince1970 * 1000),
            payload: WSMessagePayload(
                accessToken: nil,
                deviceId: nil,
                code: nil,
                sms: nil,
                calls: nil,
                sdp: nil,
                candidate: nil,
                targetId: KeychainHelper.shared.read(service: "syncline", account: "paired_device_id"),
                callId: nil,
                type: nil,
                caller: nil
            )
        )
        
        if let data = try? JSONEncoder().encode(syncMsg),
           let jsonString = String(data: data, encoding: .utf8) {
            WebSocketManager.shared.send(jsonString)
            print("Sync request sent via WebSocket.")
        }
    }
    
    private func updateCounts() {
        // SMS Count
        if let smsData = UserDefaults.standard.data(forKey: "cached_sms_messages"),
           let sms = try? JSONDecoder().decode([SmsEvent].self) {
            totalSmsCount = sms.count
        } else {
            totalSmsCount = 0
        }
        
        totalCallsCount = callLogs.count
    }
    
    func refreshMetrics() {
        checkPairingStatus()
        updateCounts()
    }
    
    // MARK: - Cache Helpers
    
    private func loadCachedCalls() {
        if let data = UserDefaults.standard.data(forKey: callCacheKey),
           let decoded = try? JSONDecoder().decode([CallEvent].self) {
            self.callLogs = decoded
        } else {
            loadMockCallData()
        }
    }
    
    private func saveCallsToCache() {
        if let data = try? JSONEncoder().encode(callLogs) {
            UserDefaults.standard.set(data, forKey: callCacheKey)
        }
    }
    
    private func loadMockCallData() {
        // Load realistic call history
        let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
        let mockNums = [
            ("5551234567", 124, "incoming"),
            ("5059876543", 0, "missed"),
            ("5432221100", 45, "outgoing"),
            ("5551234567", 0, "rejected")
        ]
        
        var mockedCalls: [CallEvent] = []
        for (index, item) in mockNums.enumerated() {
            if let encrypted = CryptoManager.shared.encrypt(item.0) {
                mockedCalls.append(CallEvent(
                    id: "mock_call_\(index)",
                    number: encrypted.ciphertext,
                    iv: encrypted.iv,
                    name: nil,
                    duration: item.1,
                    timestamp: nowMs - Int64((index * 7200) * 1000), // hours ago
                    type: item.2
                ))
            }
        }
        self.callLogs = mockedCalls
        saveCallsToCache()
    }
}

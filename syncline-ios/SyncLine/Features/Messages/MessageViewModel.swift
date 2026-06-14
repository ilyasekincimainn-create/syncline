import Foundation
import Combine

struct MessageThread: Identifiable {
    var id: String { address }
    let address: String
    var messages: [SmsEvent]
    
    var lastMessage: SmsEvent? {
        messages.max(by: { $0.timestamp < $1.timestamp })
    }
}

class MessageViewModel: ObservableObject {
    
    @Published var threads: [MessageThread] = []
    @Published var smsMessages: [SmsEvent] = [] {
        didSet {
            groupMessagesIntoThreads()
        }
    }
    
    private var cancellables = Set<AnyCancellable>()
    private let cacheKey = "cached_sms_messages"
    
    init() {
        loadCachedMessages()
        setupWebSocketObservers()
    }
    
    private func setupWebSocketObservers() {
        WebSocketManager.shared.messagePublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] jsonString in
                self?.handleIncomingWebSocketMessage(jsonString)
            }
            .store(in: &cancellables)
    }
    
    private func handleIncomingWebSocketMessage(_ jsonString: String) {
        guard let data = jsonString.data(using: .utf8),
              let message = try? JSONDecoder().decode(WSMessage.self) else {
            return
        }
        
        if message.type == "sync_sms", let incomingSms = message.payload.sms {
            mergeIncomingMessages(incomingSms)
        }
    }
    
    private func mergeIncomingMessages(_ newMessages: [SmsEvent]) {
        var currentMap = Dictionary(uniqueKeysWithValues: smsMessages.map { ($0.id, $0) })
        for msg in newMessages {
            currentMap[msg.id] = msg
        }
        self.smsMessages = Array(currentMap.values).sorted(by: { $0.timestamp > $1.timestamp })
        saveMessagesToCache()
    }
    
    func sendMessage(to address: String, body: String) {
        guard let encrypted = CryptoManager.shared.encrypt(body) else { return }
        
        let smsPayload = SmsEvent(
            id: UUID().uuidString,
            address: address,
            body: encrypted.ciphertext,
            iv: encrypted.iv,
            timestamp: Int64(Date().timeIntervalSince1970 * 1000),
            type: "outgoing",
            threadId: nil
        )
        
        let pairedId = KeychainHelper.shared.read(service: "syncline", account: "paired_device_id")
        
        let payload = WSMessagePayload(
            accessToken: nil,
            deviceId: nil,
            code: nil,
            sms: [smsPayload],
            calls: nil,
            sdp: nil,
            candidate: nil,
            targetId: pairedId,
            callId: nil,
            type: nil,
            caller: nil
        )
        
        let wsMessage = WSMessage(
            type: "send_sms",
            id: "send_sms_\(Int(Date().timeIntervalSince1970))",
            timestamp: Int64(Date().timeIntervalSince1970 * 1000),
            payload: payload
        )
        
        if let data = try? JSONEncoder().encode(wsMessage),
           let jsonString = String(data: data, encoding: .utf8) {
            WebSocketManager.shared.send(jsonString)
            
            // Add locally
            self.smsMessages.append(smsPayload)
            saveMessagesToCache()
        }
    }
    
    private func groupMessagesIntoThreads() {
        let grouped = Dictionary(grouping: smsMessages, by: { $0.address })
        let threadList = grouped.map { (key, value) in
            MessageThread(address: key, messages: value.sorted(by: { $0.timestamp < $1.timestamp }))
        }
        self.threads = threadList.sorted { (t1, t2) -> Bool in
            guard let l1 = t1.lastMessage, let l2 = t2.lastMessage else { return false }
            return l1.timestamp > l2.timestamp
        }
    }
    
    // MARK: - Cache Helpers
    
    private func loadCachedMessages() {
        if let data = UserDefaults.standard.data(forKey: cacheKey),
           let decoded = try? JSONDecoder().decode([SmsEvent].self) {
            self.smsMessages = decoded
        } else {
            // Load beautiful placeholder data for preview/first-run
            loadMockData()
        }
    }
    
    private func saveMessagesToCache() {
        if let data = try? JSONEncoder().encode(smsMessages) {
            UserDefaults.standard.set(data, forKey: cacheKey)
        }
    }
    
    private func loadMockData() {
        // Build mock messages with encrypted contents
        let mockTexts = [
            ("5551234567", "SyncLine kurulumu tamamlandı!", true),
            ("5551234567", "Harika! Cihazlar arası SMS ve arama senkronizasyonu artık aktif.", false),
            ("5059876543", "Banka Havale Onay Kodu: 948102. Bu kodu kimseyle paylaşmayınız.", true),
            ("5432221100", "Toplantı saat 14:00'da başlayacak, bilginize.", true)
        ]
        
        var mockedEvents: [SmsEvent] = []
        let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
        
        for (index, item) in mockTexts.enumerated() {
            let bodyText = item.1
            if let encrypted = CryptoManager.shared.encrypt(bodyText) {
                mockedEvents.append(SmsEvent(
                    id: "mock_sms_\(index)",
                    address: item.0,
                    body: encrypted.ciphertext,
                    iv: encrypted.iv,
                    timestamp: nowMs - Int64((index * 3600) * 1000), // hours ago
                    type: item.2 ? "incoming" : "outgoing",
                    threadId: nil
                ))
            }
        }
        self.smsMessages = mockedEvents
    }
}

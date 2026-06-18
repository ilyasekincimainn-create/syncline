import Foundation
import Combine

class WebSocketManager: NSObject, URLSessionWebSocketDelegate {
    
    static let shared = WebSocketManager()
    
    private var webSocketTask: URLSessionWebSocketTask?
    private var session: URLSession?
    
    private var isConnected = false
    private let url = URL(string: "wss://syncline-production.up.railway.app/ws")!
    
    let messagePublisher = PassthroughSubject<String, Never>()
    let connectionPublisher = CurrentValueSubject<Bool, Never>(false)
    
    private var pingTimer: Timer?
    private var reconnectTimer: Timer?
    private var reconnectDelay: TimeInterval = 1.0
    private let maxReconnectDelay: TimeInterval = 30.0
    
    private override init() {
        super.init()
    }
    
    func connect() {
        guard webSocketTask == nil else { return }
        
        session = URLSession(configuration: .default, delegate: self, delegateQueue: OperationQueue())
        webSocketTask = session?.webSocketTask(with: url)
        webSocketTask?.resume()
        
        listen()
        startPingTimer()
    }
    
    private func listen() {
        webSocketTask?.receive { [weak self] result in
            guard let self = self else { return }
            
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self.handleMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self.handleMessage(text)
                    }
                @unknown default:
                    break
                }
                self.listen() // Keep listening
                
            case .failure(let error):
                print("WebSocket receive error: \(error)")
                self.handleDisconnection()
            }
        }
    }
    
    private func handleMessage(_ text: String) {
        if let data = text.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let type = json["type"] as? String {
            
            if type == "auth_ok" {
                print("WebSocket Authenticated.")
                self.isConnected = true
                self.connectionPublisher.send(true)
                self.reconnectDelay = 1.0 // Reset backoff
            } else if type == "heartbeat_pong" {
                // Heartbeat response
            } else {
                self.messagePublisher.send(text)
            }
        }
    }
    
    private func authenticate() {
        guard let token = KeychainHelper.shared.read(service: "syncline", account: "access_token"),
              let deviceId = KeychainHelper.shared.read(service: "syncline", account: "device_id") else {
            return
        }
        
        let authMessage: [String: Any] = [
            "type": "auth",
            "id": "auth_\(Int(Date().timeIntervalSince1970))",
            "timestamp": Int(Date().timeIntervalSince1970 * 1000),
            "payload": [
                "accessToken": token,
                "deviceId": deviceId
            ]
        ]
        
        if let data = try? JSONSerialization.data(withJSONObject: authMessage),
           let jsonString = String(data: data, encoding: .utf8) {
            send(jsonString)
        }
    }
    
    func send(_ text: String) {
        webSocketTask?.send(.string(text)) { error in
            if let error = error {
                print("WebSocket send error: \(error)")
            }
        }
    }
    
    private func startPingTimer() {
        pingTimer?.invalidate()
        pingTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            self?.sendPing()
        }
    }
    
    private func sendPing() {
        let ping: [String: Any] = [
            "type": "heartbeat_ping",
            "id": "ping_\(Int(Date().timeIntervalSince1970))",
            "timestamp": Int(Date().timeIntervalSince1970 * 1000),
            "payload": [:]
        ]
        if let data = try? JSONSerialization.data(withJSONObject: ping),
           let jsonString = String(data: data, encoding: .utf8) {
            send(jsonString)
        }
    }
    
    private func handleDisconnection() {
        isConnected = false
        connectionPublisher.send(false)
        webSocketTask = nil
        pingTimer?.invalidate()
        
        // Schedule reconnection
        reconnectTimer?.invalidate()
        reconnectTimer = Timer.scheduledTimer(withTimeInterval: reconnectDelay, repeats: false) { [weak self] _ in
            guard let self = self else { return }
            self.reconnectDelay = min(self.reconnectDelay * 2, self.maxReconnectDelay)
            self.connect()
        }
    }
    
    func disconnect() {
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        webSocketTask = nil
        isConnected = false
        connectionPublisher.send(false)
        pingTimer?.invalidate()
        reconnectTimer?.invalidate()
    }
    
    // MARK: - URLSessionWebSocketDelegate
    
    func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didOpenWithProtocol protocol: String?
    ) {
        print("WebSocket Opened. Authenticating...")
        authenticate()
    }
    
    func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
        reason: Data?
    ) {
        print("WebSocket Closed: \(closeCode)")
        handleDisconnection()
    }
}

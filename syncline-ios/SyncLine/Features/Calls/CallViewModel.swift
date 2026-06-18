import Foundation
import Combine
import WebRTC
import AVFoundation

class CallViewModel: ObservableObject {
    
    enum CallState: String {
        case idle = "Boşta"
        case dialing = "Aranıyor..."
        case incoming = "Arama Geliyor..."
        case connecting = "Bağlanıyor..."
        case active = "Görüşülüyor"
        case ended = "Arama Sonlandırıldı"
    }
    
    @Published var callState: CallState = .idle
    @Published var durationString: String = "00:00"
    @Published var isMuted: Bool = false
    @Published var isSpeakerOn: Bool = false
    @Published var contactName: String = "Android Cihaz"
    
    private var webRTCClient: WebRTCClient?
    private var cancellables = Set<AnyCancellable>()
    private var durationSeconds: Int = 0
    private var timer: Timer?
    private var callId: String = UUID().uuidString
    
    init() {
        setupCallKitObservers()
        setupWebSocketObservers()
    }
    
    private func setupCallKitObservers() {
        CallKitManager.shared.onAnswerCall = { [weak self] _ in
            self?.answerCall()
        }
        
        CallKitManager.shared.onEndCall = { [weak self] _ in
            self?.hangupCall(notifyCallKit: false)
        }
        
        CallKitManager.shared.onStartCall = { [weak self] _ in
            self?.startOutgoingCallFlow()
        }
        
        CallKitManager.shared.$isMuted
            .receive(on: DispatchQueue.main)
            .assign(to: \.isMuted, on: self)
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
              let message = try? JSONDecoder().decode(WSMessage.self, from: data) else {
            return
        }
        
        switch message.type {
        case "webrtc_offer":
            guard let sdpString = message.payload.sdp else { return }
            self.callId = message.payload.callId ?? self.callId
            self.callState = .incoming
            self.contactName = message.payload.caller ?? "Bilinmeyen Numara"
            
            // Set remote offer
            let remoteSdp = RTCSessionDescription(type: .offer, sdp: sdpString)
            initializeWebRTC()
            webRTCClient?.setRemoteDescription(remoteSdp) { error in
                if let error = error {
                    print("Set remote offer error: \(error)")
                }
            }
            
        case "webrtc_answer":
            guard let sdpString = message.payload.sdp else { return }
            let remoteSdp = RTCSessionDescription(type: .answer, sdp: sdpString)
            webRTCClient?.setRemoteDescription(remoteSdp) { error in
                if let error = error {
                    print("Set remote answer error: \(error)")
                }
            }
            
        case "webrtc_candidate":
            guard let candidatePayload = message.payload.candidate else { return }
            let candidate = RTCIceCandidate(
                sdp: candidatePayload.sdp,
                sdpMLineIndex: candidatePayload.sdpMLineIndex,
                sdpMid: candidatePayload.sdpMid
            )
            webRTCClient?.addIceCandidate(candidate)
            
        default:
            break
        }
    }
    
    private func initializeWebRTC() {
        webRTCClient = WebRTCClient()
        
        webRTCClient?.onIceCandidate = { [weak self] candidate in
            self?.sendIceCandidate(candidate)
        }
        
        webRTCClient?.onConnectionStateChange = { [weak self] state in
            DispatchQueue.main.async {
                switch state {
                case .connected:
                    self?.callState = .active
                    self?.startTimer()
                case .failed, .disconnected, .closed:
                    self?.hangupCall()
                default:
                    break
                }
            }
        }
    }
    
    private func startOutgoingCallFlow() {
        self.callState = .dialing
        initializeWebRTC()
        
        webRTCClient?.createOffer { [weak self] sdp in
            guard let self = self, let sdp = sdp else { return }
            self.sendSignalingMessage(type: "webrtc_offer", sdp: sdp.sdp)
        }
    }
    
    func initiateCall(recipientNumber: String) {
        self.contactName = recipientNumber
        self.callId = UUID().uuidString
        CallKitManager.shared.startCall(handle: recipientNumber)
    }
    
    func answerCall() {
        guard callState == .incoming else { return }
        self.callState = .connecting
        
        webRTCClient?.createAnswer { [weak self] sdp in
            guard let self = self, let sdp = sdp else { return }
            self.sendSignalingMessage(type: "webrtc_answer", sdp: sdp.sdp)
        }
    }
    
    func hangupCall(notifyCallKit: Bool = true) {
        if notifyCallKit {
            CallKitManager.shared.endCall()
        }
        
        stopTimer()
        webRTCClient?.close()
        webRTCClient = nil
        callState = .ended
        
        // Clean up status after a short delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
            self?.callState = .idle
            self?.durationSeconds = 0
            self?.durationString = "00:00"
        }
    }
    
    func toggleMute() {
        isMuted.toggle()
        CallKitManager.shared.setMuted(isMuted)
    }
    
    func toggleSpeaker() {
        isSpeakerOn.toggle()
        let session = AVAudioSession.sharedInstance()
        do {
            try session.overrideOutputAudioPort(isSpeakerOn ? .speaker : .none)
        } catch {
            print("Failed to toggle speaker: \(error)")
        }
    }
    
    private func startTimer() {
        stopTimer()
        durationSeconds = 0
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            self.durationSeconds += 1
            let minutes = self.durationSeconds / 60
            let seconds = self.durationSeconds % 60
            self.durationString = String(format: "%02d:%02d", minutes, seconds)
        }
    }
    
    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }
    
    private func sendSignalingMessage(type: String, sdp: String) {
        let pairedId = KeychainHelper.shared.read(service: "syncline", account: "paired_device_id")
        let myId = KeychainHelper.shared.read(service: "syncline", account: "device_id") ?? "iOS_Client"
        
        let payload = WSMessagePayload(
            accessToken: nil,
            deviceId: nil,
            code: nil,
            sms: nil,
            calls: nil,
            sdp: sdp,
            candidate: nil,
            targetId: pairedId,
            callId: callId,
            type: type == "webrtc_offer" ? "offer" : "answer",
            caller: myId
        )
        
        let message = WSMessage(
            type: type,
            id: "\(type)_\(Int(Date().timeIntervalSince1970))",
            timestamp: Int64(Date().timeIntervalSince1970 * 1000),
            payload: payload
        )
        
        if let data = try? JSONEncoder().encode(message),
           let jsonString = String(data: data, encoding: .utf8) {
            WebSocketManager.shared.send(jsonString)
        }
    }
    
    private func sendIceCandidate(_ candidate: RTCIceCandidate) {
        let pairedId = KeychainHelper.shared.read(service: "syncline", account: "paired_device_id")
        
        let candidatePayload = WebRTCCandidate(
            sdpMid: candidate.sdpMid,
            sdpMLineIndex: candidate.sdpMLineIndex,
            sdp: candidate.sdp
        )
        
        let payload = WSMessagePayload(
            accessToken: nil,
            deviceId: nil,
            code: nil,
            sms: nil,
            calls: nil,
            sdp: nil,
            candidate: candidatePayload,
            targetId: pairedId,
            callId: callId,
            type: nil,
            caller: nil
        )
        
        let message = WSMessage(
            type: "webrtc_candidate",
            id: "candidate_\(Int(Date().timeIntervalSince1970))",
            timestamp: Int64(Date().timeIntervalSince1970 * 1000),
            payload: payload
        )
        
        if let data = try? JSONEncoder().encode(message),
           let jsonString = String(data: data, encoding: .utf8) {
            WebSocketManager.shared.send(jsonString)
        }
    }
}

import Foundation

struct WebRTCCandidate: Codable {
    let sdpMid: String?
    let sdpMLineIndex: Int32
    let sdp: String
}

struct WSMessagePayload: Codable {
    let accessToken: String?
    let deviceId: String?
    let code: String?
    let sms: [SmsEvent]?
    let calls: [CallEvent]?
    
    // WebRTC signaling fields
    let sdp: String?
    let candidate: WebRTCCandidate?
    let targetId: String?
    let callId: String?
    let type: String?
    let caller: String?
}

struct WSMessage: Codable {
    let type: String
    let id: String
    let timestamp: Int64
    let payload: WSMessagePayload
}

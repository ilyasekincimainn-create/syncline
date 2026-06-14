import Foundation

struct SmsEvent: Identifiable, Codable {
    let id: String
    let address: String
    let body: String // Can be encrypted (ciphertext)
    let iv: String?  // IV for decryption if body is encrypted
    let timestamp: Int64
    let type: String // "incoming" or "outgoing"
    let threadId: Int?
    
    var date: Date {
        Date(timeIntervalSince1970: Double(timestamp) / 1000.0)
    }
    
    var decryptedBody: String {
        guard let iv = iv else {
            return body
        }
        return CryptoManager.shared.decrypt(ciphertextBase64: body, ivBase64: iv) ?? "Çözülemedi"
    }
    
    var isIncoming: Bool {
        type.lowercased() == "incoming" || type.lowercased() == "1"
    }
}

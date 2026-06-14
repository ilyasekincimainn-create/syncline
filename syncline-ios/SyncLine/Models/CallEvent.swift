import Foundation

struct CallEvent: Identifiable, Codable {
    let id: String
    let number: String // Can be encrypted
    let iv: String?    // IV for decryption if number is encrypted
    let name: String?
    let duration: Int  // in seconds
    let timestamp: Int64
    let type: String // "incoming", "outgoing", "missed", "rejected"
    
    var date: Date {
        Date(timeIntervalSince1970: Double(timestamp) / 1000.0)
    }
    
    var decryptedNumber: String {
        guard let iv = iv else {
            return number
        }
        return CryptoManager.shared.decrypt(ciphertextBase64: number, ivBase64: iv) ?? "Bilinmeyen Numara"
    }
    
    var formattedDuration: String {
        if duration == 0 {
            return type == "missed" ? "Cevapsız" : "0 sn"
        }
        let minutes = duration / 60
        let seconds = duration % 60
        if minutes > 0 {
            return "\(minutes) dk \(seconds) sn"
        }
        return "\(seconds) sn"
    }
}

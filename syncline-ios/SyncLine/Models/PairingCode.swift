import Foundation

struct PairingCode: Codable {
    let code: String
    let expiresAt: Int64
    let isUsed: Bool
    
    var expiryDate: Date {
        Date(timeIntervalSince1970: Double(expiresAt) / 1000.0)
    }
    
    var isExpired: Bool {
        Date() > expiryDate
    }
}

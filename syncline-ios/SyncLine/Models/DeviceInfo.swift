import Foundation

struct DeviceInfo: Identifiable, Codable {
    var id: String { uuid }
    let uuid: String
    let name: String
    let model: String
    let osVersion: String
    let platform: String
    let pushToken: String?
    let pairedAt: String?
    let lastActive: String?
    
    var lastActiveDate: Date? {
        guard let lastActive = lastActive else { return nil }
        let formatter = ISO8601DateFormatter()
        return formatter.date(from: lastActive)
    }
    
    var isOnline: Bool {
        guard let date = lastActiveDate else { return false }
        return Date().timeIntervalSince(date) < 60.0 // Active in last minute
    }
}

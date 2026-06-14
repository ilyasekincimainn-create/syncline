import SwiftUI

extension Color {
    // Theme Colors
    static let primaryBackground = Color(hex: "0A0E17")
    static let secondaryBackground = Color(hex: "121824")
    static let cardBackground = Color(hex: "1F293D").opacity(0.4)
    
    static let neonBlue = Color(hex: "00F0FF")
    static let neonCyan = Color(hex: "00FFD1")
    static let neonPurple = Color(hex: "9D00FF")
    static let neonPink = Color(hex: "FF007A")
    static let neonGreen = Color(hex: "39FF14")
    static let neonRed = Color(hex: "FF3131")
    
    static let textPrimary = Color.white
    static let textSecondary = Color(hex: "8F9CAE")
    static let borderGlass = Color.white.opacity(0.15)
    
    // Gradients
    static var premiumGradient: LinearGradient {
        LinearGradient(
            colors: [Color.neonPurple, Color.neonBlue],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
    
    static var glassGradient: LinearGradient {
        LinearGradient(
            colors: [Color.white.opacity(0.1), Color.white.opacity(0.03)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
    
    static var accentGradient: LinearGradient {
        LinearGradient(
            colors: [Color.neonBlue, Color.neonCyan],
            startPoint: .leading,
            endPoint: .trailing
        )
    }
    
    static var dangerGradient: LinearGradient {
        LinearGradient(
            colors: [Color.neonRed, Color.neonPink],
            startPoint: .leading,
            endPoint: .trailing
        )
    }
    
    // Hex initializer helper
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 1)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

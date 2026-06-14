import SwiftUI

extension Font {
    static func premiumTitle1() -> Font {
        .system(size: 28, weight: .bold, design: .rounded)
    }
    
    static func premiumTitle2() -> Font {
        .system(size: 22, weight: .semibold, design: .rounded)
    }
    
    static func premiumHeadline() -> Font {
        .system(size: 17, weight: .semibold, design: .rounded)
    }
    
    static func premiumBody() -> Font {
        .system(size: 15, weight: .regular, design: .default)
    }
    
    static func premiumCallout() -> Font {
        .system(size: 14, weight: .medium, design: .default)
    }
    
    static func premiumFootnote() -> Font {
        .system(size: 12, weight: .light, design: .default)
    }
    
    static func premiumCode() -> Font {
        .system(size: 16, weight: .bold, design: .monospaced)
    }
}

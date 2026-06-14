import SwiftUI

struct PulsingDot: View {
    let color: Color
    @State private var animate = false
    
    var body: some View {
        ZStack {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)
            
            Circle()
                .stroke(color, lineWidth: 2)
                .frame(width: 20, height: 20)
                .scaleEffect(animate ? 1.0 : 0.2)
                .opacity(animate ? 0.0 : 0.8)
        }
        .onAppear {
            withAnimation(
                .easeInOut(duration: 1.5)
                .repeatForever(autoreverses: false)
            ) {
                animate = true
            }
        }
    }
}

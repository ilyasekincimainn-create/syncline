import SwiftUI

struct MessageDetailView: View {
    let thread: MessageThread
    @ObservedObject var viewModel: MessageViewModel
    @State private var messageText: String = ""
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        ZStack {
            // Background
            Color.primaryBackground
                .ignoresSafeArea()
            
            VStack {
                // Chat bubble list
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(spacing: 14) {
                            ForEach(getCurrentThreadMessages()) { msg in
                                ChatBubble(message: msg)
                                    .id(msg.id)
                            }
                        }
                        .padding()
                    }
                    .onAppear {
                        scrollToBottom(proxy: proxy)
                    }
                    .onChange(of: thread.messages.count) { _ in
                        scrollToBottom(proxy: proxy)
                    }
                }
                
                // Message composer block
                composerPanel
            }
        }
        .navigationTitle(thread.address)
        .navigationBarTitleDisplayMode(.inline)
    }
    
    private func getCurrentThreadMessages() -> [SmsEvent] {
        if let currentThread = viewModel.threads.first(where: { $0.address == thread.address }) {
            return currentThread.messages
        }
        return thread.messages
    }
    
    private func scrollToBottom(proxy: ScrollViewProxy) {
        if let last = getCurrentThreadMessages().last {
            withAnimation {
                proxy.scrollTo(last.id, anchor: .bottom)
            }
        }
    }
    
    private var composerPanel: some View {
        GlassCard(cornerRadius: 0) {
            HStack(spacing: 12) {
                TextField("Mesaj yaz...", text: $messageText)
                    .padding(12)
                    .background(Color.white.opacity(0.08))
                    .cornerRadius(8)
                    .foregroundColor(.white)
                    .font(.premiumBody())
                
                Button(action: {
                    guard !messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
                    viewModel.sendMessage(to: thread.address, body: messageText)
                    messageText = ""
                }) {
                    Image(systemName: "paperplane.fill")
                        .font(.headline)
                        .foregroundColor(.white)
                        .padding(12)
                        .background(Color.neonBlue)
                        .clipShape(Circle())
                        .shadow(color: Color.neonBlue.opacity(0.3), radius: 6)
                }
                .disabled(messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding(.horizontal)
            .padding(.bottom, 8)
        }
    }
}

struct ChatBubble: View {
    let message: SmsEvent
    
    var body: some View {
        HStack {
            if message.isIncoming {
                VStack(alignment: .leading, spacing: 4) {
                    Text(message.decryptedBody)
                        .foregroundColor(.white)
                        .font(.premiumBody())
                        .padding(12)
                        .background(Color.white.opacity(0.12))
                        .cornerRadius(16, corners: [.topRight, .bottomLeft, .bottomRight])
                    
                    Text(formatTime(message.timestamp))
                        .font(.premiumFootnote())
                        .foregroundColor(.textSecondary)
                        .padding(.leading, 4)
                }
                Spacer(minLength: 60)
            } else {
                Spacer(minLength: 60)
                VStack(alignment: .trailing, spacing: 4) {
                    Text(message.decryptedBody)
                        .foregroundColor(.white)
                        .font(.premiumBody())
                        .padding(12)
                        .background(
                            LinearGradient(
                                colors: [Color.neonPurple, Color.neonPink],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .cornerRadius(16, corners: [.topLeft, .bottomLeft, .bottomRight])
                        .shadow(color: Color.neonPurple.opacity(0.2), radius: 4)
                    
                    Text(formatTime(message.timestamp))
                        .font(.premiumFootnote())
                        .foregroundColor(.textSecondary)
                        .padding(.trailing, 4)
                }
            }
        }
    }
    
    private func formatTime(_ timestamp: Int64) -> String {
        let date = Date(timeIntervalSince1970: Double(timestamp) / 1000.0)
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }
}

// Helper for rounded corners selectively
extension View {
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape(RoundedCorner(radius: radius, corners: corners))
    }
}

struct RoundedCorner: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(roundedRect: rect, byRoundingCorners: corners, cornerRadii: CGSize(width: radius, height: radius))
        return Path(path.cgPath)
    }
}

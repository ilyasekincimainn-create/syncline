import SwiftUI

struct MessageRowView: View {
    let thread: MessageThread
    
    var body: some View {
        HStack(spacing: 16) {
            // Avatar with initials or custom icon
            ZStack {
                Circle()
                    .fill(Color.neonPurple.opacity(0.15))
                    .frame(width: 48, height: 48)
                    .overlay(
                        Circle()
                            .stroke(Color.neonPurple.opacity(0.4), lineWidth: 1)
                    )
                
                Image(systemName: "message.fill")
                    .foregroundColor(.neonPurple)
                    .font(.system(size: 18))
            }
            
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(thread.address)
                        .font(.premiumHeadline())
                        .foregroundColor(.white)
                    
                    Spacer()
                    
                    if let lastMsg = thread.lastMessage {
                        Text(formatTimestamp(lastMsg.timestamp))
                            .font(.premiumFootnote())
                            .foregroundColor(.textSecondary)
                    }
                }
                
                if let lastMsg = thread.lastMessage {
                    Text(lastMsg.decryptedBody)
                        .font(.premiumBody())
                        .foregroundColor(.textSecondary)
                        .lineLimit(1)
                }
            }
        }
        .padding(.vertical, 8)
    }
    
    private func formatTimestamp(_ timestamp: Int64) -> String {
        let date = Date(timeIntervalSince1970: Double(timestamp) / 1000.0)
        let calendar = Calendar.current
        
        if calendar.isDateInToday(date) {
            let formatter = DateFormatter()
            formatter.dateFormat = "HH:mm"
            return formatter.string(from: date)
        } else if calendar.isDateInYesterday(date) {
            return "Dün"
        } else {
            let formatter = DateFormatter()
            formatter.dateFormat = "dd/MM/yyyy"
            return formatter.string(from: date)
        }
    }
}

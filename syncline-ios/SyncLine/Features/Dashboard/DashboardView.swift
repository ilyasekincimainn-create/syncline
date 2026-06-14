import SwiftUI

struct DashboardView: View {
    @StateObject private var viewModel = DashboardViewModel()
    @State private var showingSyncingAnimation = false
    
    var body: some View {
        NavigationStack {
            ZStack {
                // Background
                Color.primaryBackground
                    .ignoresSafeArea()
                
                // Tech background details (Neon blurs)
                RadialGradient(
                    colors: [Color.neonBlue.opacity(0.12), Color.clear],
                    center: .topLeading,
                    startRadius: 50,
                    endRadius: 500
                )
                .ignoresSafeArea()
                
                RadialGradient(
                    colors: [Color.neonPurple.opacity(0.08), Color.clear],
                    center: .bottomTrailing,
                    startRadius: 100,
                    endRadius: 600
                )
                .ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: 24) {
                        
                        // Header Status Panel
                        statusHeaderPanel
                        
                        // Action / Sync Button Row
                        syncActionBlock
                        
                        // Grid of Stats
                        statsGrid
                        
                        // Recent Calls List
                        recentCallsSection
                        
                    }
                    .padding()
                }
                .refreshable {
                    viewModel.refreshMetrics()
                }
            }
            .navigationTitle("SyncLine")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    HStack(spacing: 8) {
                        if viewModel.isConnected {
                            PulsingDot(color: .neonGreen)
                        } else {
                            Circle()
                                .fill(Color.neonRed)
                                .frame(width: 8, height: 8)
                        }
                        Text(viewModel.isConnected ? "Bağlı" : "Çevrimdışı")
                            .font(.premiumFootnote())
                            .foregroundColor(viewModel.isConnected ? .neonGreen : .neonRed)
                    }
                }
            }
        }
    }
    
    private var statusHeaderPanel: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Eşleştirilmiş Cihaz")
                            .font(.premiumFootnote())
                            .foregroundColor(.textSecondary)
                        
                        Text(viewModel.pairedDeviceName)
                            .font(.premiumTitle2())
                            .foregroundColor(.textPrimary)
                    }
                    Spacer()
                    
                    Image(systemName: viewModel.isPaired ? "iphone.radiowaves.left.and.right" : "iphone.slash")
                        .font(.system(size: 28))
                        .foregroundColor(viewModel.isPaired ? .neonBlue : .textSecondary)
                }
                
                Divider()
                    .background(Color.borderGlass)
                
                HStack {
                    Text(viewModel.isPaired ? "Köprüleme aktif. Bildirimler ve aramalar yönlendiriliyor." : "Eşleştirme yapılmadı. Lütfen ayarlardan eşleştirin.")
                        .font(.premiumCallout())
                        .foregroundColor(.textSecondary)
                }
            }
            .padding()
        }
    }
    
    private var syncActionBlock: some View {
        Button(action: {
            withAnimation(.easeInOut(duration: 1.0)) {
                showingSyncingAnimation = true
            }
            viewModel.syncNow()
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                showingSyncingAnimation = false
                viewModel.refreshMetrics()
            }
        }) {
            HStack(spacing: 8) {
                Image(systemName: "arrow.clockwise")
                    .rotationEffect(.degrees(showingSyncingAnimation ? 360 : 0))
                    .animation(showingSyncingAnimation ? .linear(duration: 1).repeatForever(autoreverses: false) : .default, value: showingSyncingAnimation)
                Text(showingSyncingAnimation ? "Eşitleniyor..." : "Şimdi Eşitle")
                    .font(.premiumHeadline())
            }
            .foregroundColor(.white)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity)
            .background(
                viewModel.isConnected
                ? Color.premiumGradient
                : LinearGradient(colors: [Color.textSecondary.opacity(0.3), Color.textSecondary.opacity(0.1)], startPoint: .leading, endPoint: .trailing)
            )
            .cornerRadius(12)
            .shadow(color: viewModel.isConnected ? Color.neonBlue.opacity(0.2) : Color.clear, radius: 8, x: 0, y: 4)
        }
        .disabled(!viewModel.isConnected || showingSyncingAnimation)
    }
    
    private var statsGrid: some View {
        HStack(spacing: 16) {
            // SMS count card
            GlassCard {
                VStack(spacing: 10) {
                    Image(systemName: "message.fill")
                        .font(.title)
                        .foregroundColor(.neonPurple)
                    Text("\(viewModel.totalSmsCount)")
                        .font(.premiumTitle1())
                        .foregroundColor(.textPrimary)
                    Text("Toplam Mesaj")
                        .font(.premiumFootnote())
                        .foregroundColor(.textSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding()
            }
            
            // Call count card
            GlassCard {
                VStack(spacing: 10) {
                    Image(systemName: "phone.fill")
                        .font(.title)
                        .foregroundColor(.neonBlue)
                    Text("\(viewModel.totalCallsCount)")
                        .font(.premiumTitle1())
                        .foregroundColor(.textPrimary)
                    Text("Arama Geçmişi")
                        .font(.premiumFootnote())
                        .foregroundColor(.textSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding()
            }
        }
    }
    
    private var recentCallsSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Son Aramalar")
                .font(.premiumTitle2())
                .foregroundColor(.textPrimary)
                .padding(.horizontal, 4)
            
            if viewModel.callLogs.isEmpty {
                GlassCard {
                    HStack {
                        Spacer()
                        VStack(spacing: 8) {
                            Image(systemName: "phone.badge.plus")
                                .font(.largeTitle)
                                .foregroundColor(.textSecondary)
                            Text("Arama geçmişi temiz.")
                                .font(.premiumBody())
                                .foregroundColor(.textSecondary)
                        }
                        Spacer()
                    }
                    .padding()
                }
            } else {
                ForEach(viewModel.callLogs.prefix(10)) { call in
                    GlassCard {
                        HStack(spacing: 14) {
                            callTypeIcon(for: call.type)
                            
                            VStack(alignment: .leading, spacing: 4) {
                                Text(call.decryptedNumber)
                                    .font(.premiumHeadline())
                                    .foregroundColor(.textPrimary)
                                
                                HStack(spacing: 8) {
                                    Text(call.formattedDuration)
                                        .font(.premiumFootnote())
                                        .foregroundColor(.textSecondary)
                                    
                                    Circle()
                                        .fill(Color.borderGlass)
                                        .frame(width: 4, height: 4)
                                    
                                    Text(formatDate(call.date))
                                        .font(.premiumFootnote())
                                        .foregroundColor(.textSecondary)
                                }
                            }
                            
                            Spacer()
                        }
                        .padding(12)
                    }
                }
            }
        }
    }
    
    private func callTypeIcon(for type: String) -> some View {
        let icon: String
        let color: Color
        
        switch type {
        case "incoming":
            icon = "phone.arrow.down.left"
            color = .neonGreen
        case "outgoing":
            icon = "phone.arrow.up.right"
            color = .neonBlue
        case "missed":
            icon = "phone.fill.arrow.down.left"
            color = .neonRed
        case "rejected":
            icon = "phone.fill.slash"
            color = .textSecondary
        default:
            icon = "phone.fill"
            color = .neonBlue
        }
        
        return Image(systemName: icon)
            .font(.title3)
            .foregroundColor(color)
            .frame(width: 40, height: 40)
            .background(color.opacity(0.12))
            .clipShape(Circle())
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "tr_TR")
        if Calendar.current.isDateInToday(date) {
            formatter.dateFormat = "HH:mm"
            return "Bugün \(formatter.string(from: date))"
        } else if Calendar.current.isDateInYesterday(date) {
            formatter.dateFormat = "HH:mm"
            return "Dün \(formatter.string(from: date))"
        } else {
            formatter.dateFormat = "dd MMM, HH:mm"
            return formatter.string(from: date)
        }
    }
}

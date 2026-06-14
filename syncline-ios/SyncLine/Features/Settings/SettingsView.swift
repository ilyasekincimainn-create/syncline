import SwiftUI

struct SettingsView: View {
    @StateObject private var viewModel = SettingsViewModel()
    @State private var showingUnpairConfirmation = false
    
    var body: some View {
        NavigationStack {
            ZStack {
                // Background
                Color.primaryBackground
                    .ignoresSafeArea()
                
                // Tech background blurs
                RadialGradient(
                    colors: [Color.neonPurple.opacity(0.1), Color.clear],
                    center: .topTrailing,
                    startRadius: 50,
                    endRadius: 450
                )
                .ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: 20) {
                        
                        // Device Association Panel
                        deviceDetailsPanel
                        
                        // Connection / WebSocket Status Card
                        connectionStatusPanel
                        
                        // End-to-End Cryptography Card
                        cryptographyPanel
                        
                        // Push Settings Card
                        pushSettingsPanel
                        
                        Spacer()
                        
                        // Destructive Unpair Button
                        if viewModel.isPaired {
                            unpairButton
                        }
                    }
                    .padding()
                }
                .onAppear {
                    viewModel.refreshState()
                }
            }
            .navigationTitle("Ayarlar")
            .navigationBarTitleDisplayMode(.inline)
            .alert("Cihaz Eşleştirmesini Kaldır", isPresented: $showingUnpairConfirmation) {
                Button("İptal", role: .cancel) { }
                Button("Kaldır", role: .destructive) {
                    viewModel.unpairDevice()
                }
            } message: {
                Text("Eşleştirmeyi kaldırdığınızda yerel mesajlar, çağrı kayıtları ve anahtarlar silinecektir. Devam etmek istiyor musunuz?")
            }
        }
    }
    
    private var deviceDetailsPanel: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Image(systemName: "iphone.circle.fill")
                        .foregroundColor(.neonBlue)
                        .font(.title2)
                    Text("Cihaz Kimlikleri")
                        .font(.premiumHeadline())
                        .foregroundColor(.textPrimary)
                }
                
                Divider()
                    .background(Color.borderGlass)
                
                VStack(alignment: .leading, spacing: 10) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Bu Cihaz (iOS)")
                            .font(.premiumFootnote())
                            .foregroundColor(.textSecondary)
                        Text(viewModel.deviceId)
                            .font(.system(size: 14, weight: .medium, design: .monospaced))
                            .foregroundColor(.textPrimary)
                    }
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Eşli Companion (Android)")
                            .font(.premiumFootnote())
                            .foregroundColor(.textSecondary)
                        Text(viewModel.pairedDeviceId)
                            .font(.system(size: 14, weight: .medium, design: .monospaced))
                            .foregroundColor(.textPrimary)
                    }
                }
            }
            .padding()
        }
    }
    
    private var connectionStatusPanel: some View {
        GlassCard {
            HStack(spacing: 16) {
                Image(systemName: "network")
                    .foregroundColor(viewModel.isConnected ? .neonGreen : .neonRed)
                    .font(.title2)
                
                VStack(alignment: .leading, spacing: 4) {
                    Text("Bağlantı Durumu")
                        .font(.premiumHeadline())
                        .foregroundColor(.textPrimary)
                    Text(viewModel.isConnected ? "WebSocket Sunucusuna Bağlı" : "Bağlantı Kesildi")
                        .font(.premiumFootnote())
                        .foregroundColor(.textSecondary)
                }
                
                Spacer()
                
                PulsingDot(color: viewModel.isConnected ? .neonGreen : .neonRed)
            }
            .padding()
        }
    }
    
    private var cryptographyPanel: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Image(systemName: "lock.shield.fill")
                        .foregroundColor(.neonPurple)
                        .font(.title2)
                    Text("Uçtan Uca Güvenlik (E2E)")
                        .font(.premiumHeadline())
                        .foregroundColor(.textPrimary)
                }
                
                Divider()
                    .background(Color.borderGlass)
                
                VStack(alignment: .leading, spacing: 10) {
                    Text(viewModel.encryptionKeyStatus)
                        .font(.premiumCallout())
                        .foregroundColor(.textPrimary)
                    
                    Text("Tüm aramalar, SMS'ler ve bildirimler mobil ağdan alındığında 256-bit AES-GCM ile şifrelenir ve aradaki sunucular dahil kimse tarafından okunamaz.")
                        .font(.premiumFootnote())
                        .foregroundColor(.textSecondary)
                        .lineLimit(nil)
                        .fixedSize(horizontal: false, vertical: true)
                    
                    Button(action: {
                        viewModel.regenerateKeys()
                    }) {
                        Text("Anahtar Çiftini Yenile")
                            .font(.premiumFootnote())
                            .foregroundColor(.neonPurple)
                            .padding(.vertical, 6)
                            .padding(.horizontal, 12)
                            .background(Color.neonPurple.opacity(0.12))
                            .cornerRadius(8)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color.neonPurple.opacity(0.3), lineWidth: 1)
                            )
                    }
                }
            }
            .padding()
        }
    }
    
    private var pushSettingsPanel: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Image(systemName: "bell.badge.fill")
                        .foregroundColor(.neonPink)
                        .font(.title2)
                    Text("Push Notification (APNs)")
                        .font(.premiumHeadline())
                        .foregroundColor(.textPrimary)
                }
                
                Divider()
                    .background(Color.borderGlass)
                
                VStack(alignment: .leading, spacing: 6) {
                    Text("APNs VoIP Cihaz Tokenı:")
                        .font(.premiumFootnote())
                        .foregroundColor(.textSecondary)
                    Text(viewModel.apnsToken)
                        .font(.system(size: 11, weight: .light, design: .monospaced))
                        .foregroundColor(.textPrimary)
                        .lineLimit(2)
                        .minimumScaleFactor(0.8)
                    
                    Text("Giriş yapan çağrılarda CallKit entegrasyonu ve anında uyanma için PushKit kullanılmaktadır.")
                        .font(.premiumFootnote())
                        .foregroundColor(.textSecondary)
                        .padding(.top, 4)
                }
            }
            .padding()
        }
    }
    
    private var unpairButton: some View {
        Button(action: {
            showingUnpairConfirmation = true
        }) {
            HStack {
                Image(systemName: "trash.fill")
                Text("Eşleştirmeyi Kaldır ve Sıfırla")
                    .font(.premiumHeadline())
            }
            .foregroundColor(.white)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity)
            .background(Color.dangerGradient)
            .cornerRadius(12)
            .shadow(color: Color.neonRed.opacity(0.3), radius: 8, x: 0, y: 4)
        }
    }
}

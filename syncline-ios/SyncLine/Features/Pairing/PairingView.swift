import SwiftUI

struct PairingView: View {
    @StateObject private var viewModel = PairingViewModel()
    @State private var showingScanner = false
    @State private var manualCode = ""
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        ZStack {
            // Background
            Color.primaryBackground
                .ignoresSafeArea()
            
            // Background Blurs
            RadialGradient(
                colors: [Color.neonPurple.opacity(0.12), Color.clear],
                center: .topLeading,
                startRadius: 50,
                endRadius: 400
            )
            .ignoresSafeArea()
            
            RadialGradient(
                colors: [Color.neonBlue.opacity(0.1), Color.clear],
                center: .bottomTrailing,
                startRadius: 100,
                endRadius: 500
            )
            .ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 30) {
                    // Title section
                    VStack(spacing: 8) {
                        Image(systemName: "link.icu")
                            .font(.system(size: 64))
                            .foregroundColor(.neonBlue)
                            .shadow(color: Color.neonBlue.opacity(0.4), radius: 10)
                            .padding(.top, 40)
                        
                        Text("Cihaz Eşleştirme")
                            .font(.premiumTitle1())
                            .foregroundColor(.white)
                        
                        Text("Android cihazınızdaki QR kodunu taratarak veya eşleştirme kodunu girerek SyncLine ağını kurun.")
                            .font(.premiumBody())
                            .foregroundColor(.textSecondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 24)
                    }
                    
                    if viewModel.isPaired {
                        // Success Paired State
                        GlassCard {
                            VStack(spacing: 16) {
                                Image(systemName: "checkmark.seal.fill")
                                    .font(.system(size: 48))
                                    .foregroundColor(.neonGreen)
                                    .shadow(color: Color.neonGreen.opacity(0.3), radius: 8)
                                
                                Text("Cihaz Eşleştirildi")
                                    .font(.premiumTitle2())
                                    .foregroundColor(.white)
                                
                                Text("Senkronizasyon kanalı açık ve korumalı (AES-256-GCM).")
                                    .font(.premiumFootnote())
                                    .foregroundColor(.textSecondary)
                                    .multilineTextAlignment(.center)
                                
                                let pairedId = KeychainHelper.shared.read(service: "syncline", account: "paired_device_id") ?? "Bilinmeyen Cihaz"
                                
                                Text("Bağlı Cihaz Kimliği:")
                                    .font(.premiumFootnote())
                                    .foregroundColor(.textSecondary)
                                    .padding(.top, 8)
                                
                                Text(pairedId)
                                    .font(.premiumCode())
                                    .foregroundColor(.neonBlue)
                                    .padding(8)
                                    .background(Color.white.opacity(0.06))
                                    .cornerRadius(6)
                                    .lineLimit(1)
                                
                                Button(action: {
                                    viewModel.unpair()
                                }) {
                                    Text("Eşleştirmeyi Kaldır")
                                        .font(.premiumHeadline())
                                        .foregroundColor(.white)
                                        .padding(.vertical, 12)
                                        .frame(maxWidth: .infinity)
                                        .background(Color.neonRed.opacity(0.2))
                                        .cornerRadius(10)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 10)
                                                .stroke(Color.neonRed, lineWidth: 1)
                                        )
                                }
                                .padding(.top, 10)
                            }
                            .padding()
                        }
                        .padding(.horizontal, 24)
                        
                    } else {
                        // Unpaired view options
                        VStack(spacing: 20) {
                            // Scan QR Option
                            Button(action: {
                                showingScanner = true
                            }) {
                                HStack(spacing: 12) {
                                    Image(systemName: "qrcode.viewfinder")
                                        .font(.title2)
                                    Text("QR Kodunu Tara")
                                        .font(.premiumHeadline())
                                }
                                .foregroundColor(.white)
                                .padding(.vertical, 16)
                                .frame(maxWidth: .infinity)
                                .background(Color.premiumGradient)
                                .cornerRadius(12)
                                .shadow(color: Color.neonPurple.opacity(0.4), radius: 10)
                            }
                            
                            // Divider
                            HStack {
                                Rectangle()
                                    .fill(Color.borderGlass)
                                    .frame(height: 1)
                                Text("VEYA")
                                    .font(.premiumFootnote())
                                    .foregroundColor(.textSecondary)
                                    .padding(.horizontal, 8)
                                Rectangle()
                                    .fill(Color.borderGlass)
                                    .frame(height: 1)
                            }
                            .padding(.vertical, 10)
                            
                            // Manual Input Option
                            GlassCard {
                                VStack(alignment: .leading, spacing: 12) {
                                    Text("Manuel Eşleştirme Kodu")
                                        .font(.premiumHeadline())
                                        .foregroundColor(.white)
                                    
                                    TextField("Eşleştirme kodunu girin", text: $manualCode)
                                        .autocapitalization(.allCharacters)
                                        .disableAutocorrection(true)
                                        .padding(14)
                                        .background(Color.white.opacity(0.08))
                                        .cornerRadius(10)
                                        .foregroundColor(.white)
                                        .font(.premiumBody())
                                    
                                    if let error = viewModel.pairingError {
                                        Text(error)
                                            .font(.premiumFootnote())
                                            .foregroundColor(.neonRed)
                                    }
                                    
                                    Button(action: {
                                        guard !manualCode.trimmingCharacters(in: .whitespaces).isEmpty else { return }
                                        viewModel.pair(with: manualCode)
                                    }) {
                                        if viewModel.isPairing {
                                            ProgressView()
                                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                                .frame(maxWidth: .infinity)
                                                .padding(.vertical, 12)
                                        } else {
                                            Text("Kodu Gönder")
                                                .font(.premiumHeadline())
                                                .foregroundColor(.white)
                                                .padding(.vertical, 12)
                                                .frame(maxWidth: .infinity)
                                                .background(Color.neonBlue)
                                                .cornerRadius(10)
                                                .shadow(color: Color.neonBlue.opacity(0.3), radius: 8)
                                        }
                                    }
                                    .disabled(viewModel.isPairing || manualCode.trimmingCharacters(in: .whitespaces).isEmpty)
                                }
                            }
                        }
                        .padding(.horizontal, 24)
                    }
                }
            }
        }
        .sheet(isPresented: $showingScanner) {
            ZStack {
                QRScannerView(
                    onCodeScanned: { code in
                        showingScanner = false
                        viewModel.pair(with: code)
                    },
                    onFailure: { error in
                        showingScanner = false
                        viewModel.pairingError = error.localizedDescription
                    }
                )
                .ignoresSafeArea()
                
                // Crosshair overlay
                VStack {
                    HStack {
                        Button(action: { showingScanner = false }) {
                            Image(systemName: "xmark.circle.fill")
                                .font(.title)
                                .foregroundColor(.white)
                                .padding()
                        }
                        Spacer()
                    }
                    Spacer()
                    
                    // Box Outline
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.neonBlue, lineWidth: 2)
                        .frame(width: 250, height: 250)
                        .shadow(color: Color.neonBlue.opacity(0.5), radius: 10)
                    
                    Spacer()
                }
            }
        }
    }
}

import SwiftUI

struct MainShellView: View {
    @State private var selectedTab = 0
    @State private var isPaired = false
    
    var body: some View {
        ZStack {
            if isPaired {
                TabView(selection: $selectedTab) {
                    DashboardView()
                        .tabItem {
                            Label("Dashboard", systemImage: "square.grid.2x2.fill")
                        }
                        .tag(0)
                    
                    MessageListView()
                        .tabItem {
                            Label("Mesajlar", systemImage: "message.fill")
                        }
                        .tag(1)
                    
                    SettingsView()
                        .tabItem {
                            Label("Ayarlar", systemImage: "gearshape.fill")
                        }
                        .tag(2)
                }
                .accentColor(.neonBlue)
            } else {
                PairingView()
            }
        }
        .onAppear {
            checkPairing()
            NotificationCenter.default.addObserver(forName: Notification.Name("DevicePairingStateChanged"), object: nil, queue: .main) { _ in
                checkPairing()
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: Notification.Name("DevicePairingStateChanged"))) { _ in
            checkPairing()
        }
    }
    
    private func checkPairing() {
        let pairedId = KeychainHelper.shared.read(service: "syncline", account: "paired_device_id")
        withAnimation {
            isPaired = (pairedId != nil)
        }
    }
}

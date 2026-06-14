import SwiftUI

@main
struct SyncLineApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            MainShellView()
                .preferredColorScheme(.dark)
        }
    }
}

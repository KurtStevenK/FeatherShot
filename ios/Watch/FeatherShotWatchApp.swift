import SwiftUI

/// FeatherShot on Apple Watch: the screenshots you annotated on your iPhone, to glance at or
/// show someone. The iPhone sends a small copy after each Save & Copy (WatchConnectivity);
/// nothing leaves your own devices.
@main
struct FeatherShotWatchApp: App {
    @State private var store = ShotStore.shared

    init() {
        ShotStore.shared.activate()
    }

    var body: some Scene {
        WindowGroup {
            ShotListView(store: store)
        }
    }
}

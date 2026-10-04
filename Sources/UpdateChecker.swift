import Foundation
import AppKit

enum UpdateChecker {
    private static let latestReleaseURL = URL(string: "https://api.github.com/repos/KurtStevenK/FeatherShot/releases/latest")!
    private static let downloadPageURL = URL(string: "https://github.com/KurtStevenK/FeatherShot/releases/latest")!

    static var currentVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0"
    }

    static func checkForUpdates() {
        Task {
            do {
                let (data, response) = try await URLSession.shared.data(from: latestReleaseURL)
                guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                    await showError("Could not reach GitHub (HTTP \((response as? HTTPURLResponse)?.statusCode ?? 0)).")
                    return
                }
                guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let tag = json["tag_name"] as? String else {
                    await showError("Unexpected response from GitHub.")
                    return
                }
                let latest = tag.hasPrefix("v") ? String(tag.dropFirst()) : tag
                let current = currentVersion
                if compareVersions(latest, current) <= 0 {
                    await showInfo("FeatherShot \(current) is the latest release.")
                    return
                }
                let name = (json["name"] as? String) ?? "v\(latest)"
                await showUpdateAvailable(latest: latest, title: name)
            } catch {
                await showError("Update check failed: \(error.localizedDescription)")
            }
        }
    }

    /// Returns positive if `a` is newer than `b`.
    static func compareVersions(_ a: String, _ b: String) -> Int {
        let pa = a.split(separator: ".").compactMap { Int($0) }
        let pb = b.split(separator: ".").compactMap { Int($0) }
        let count = max(pa.count, pb.count)
        for i in 0..<count {
            let va = i < pa.count ? pa[i] : 0
            let vb = i < pb.count ? pb[i] : 0
            if va != vb { return va - vb }
        }
        return 0
    }

    @MainActor
    private static func showInfo(_ message: String) {
        let alert = NSAlert()
        alert.messageText = "FeatherShot"
        alert.informativeText = message
        alert.alertStyle = .informational
        alert.runModal()
    }

    @MainActor
    private static func showError(_ message: String) {
        let alert = NSAlert()
        alert.messageText = "Check for Updates"
        alert.informativeText = message
        alert.alertStyle = .warning
        alert.runModal()
    }

    @MainActor
    private static func showUpdateAvailable(latest: String, title: String) {
        let alert = NSAlert()
        alert.messageText = "Update available: \(title)"
        alert.informativeText = """
        A newer version (\(latest)) is available. Your version is \(currentVersion).

        Download the DMG from GitHub, or if you installed with Homebrew:
        brew upgrade --cask feathershot
        """
        alert.alertStyle = .informational
        alert.addButton(withTitle: "Open Download Page")
        alert.addButton(withTitle: "Cancel")
        if alert.runModal() == .alertFirstButtonReturn {
            NSWorkspace.shared.open(downloadPageURL)
        }
    }
}

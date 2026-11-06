import UIKit
import WatchConnectivity

/// Sends a small copy of each saved screenshot to the FeatherShot Watch app, when one is
/// installed. Only between the user's own iPhone and Apple Watch; nothing goes to a server.
final class WatchSync: NSObject, WCSessionDelegate, @unchecked Sendable {
    static let shared = WatchSync()
    /// Longest side of the copy: enough for the watch screen with Digital Crown zoom.
    static let maxPixels: CGFloat = 900

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    /// Queues the screenshot for the watch; WatchConnectivity delivers it in the background.
    func send(png: Data, date: Date = Date()) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated, session.isPaired, session.isWatchAppInstalled,
              let image = UIImage(data: png), let jpeg = Self.thumbnail(of: image)?.jpegData(compressionQuality: 0.85) else {
            return
        }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("watch-\(UUID().uuidString).jpg")
        do {
            try jpeg.write(to: url)
            session.transferFile(url, metadata: ["date": date.timeIntervalSince1970])
        } catch {
            // The watch copy is a convenience; Save & Copy already succeeded.
        }
    }

    static func thumbnail(of image: UIImage) -> UIImage? {
        let pixels = CGSize(width: image.size.width * image.scale, height: image.size.height * image.scale)
        let factor = min(1, maxPixels / max(pixels.width, pixels.height))
        let size = CGSize(width: (pixels.width * factor).rounded(), height: (pixels.height * factor).rounded())
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
    }

    // MARK: - WCSessionDelegate

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) {
        // After switching watches, start a session with the new one.
        session.activate()
    }

    func session(_ session: WCSession, didFinish fileTransfer: WCSessionFileTransfer, error: Error?) {
        try? FileManager.default.removeItem(at: fileTransfer.file.fileURL)
    }
}

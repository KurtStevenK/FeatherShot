import SwiftUI
import Observation

/// What the app shows, and the screenshot it is working on.
/// `OpenScreenshotIntent` runs in the app process and hands its file over through `shared`.
@MainActor @Observable
final class AppModel {
    static let shared = AppModel()

    enum Screen: Equatable {
        case home
        /// The full screenshot, waiting for the user to pick the area to keep.
        case crop(URL)
        case edit(EditSession)
        case done
    }

    private(set) var screen: Screen = .home

    /// The temp file of the current screenshot. Deleted on Save & Copy, Cancel, or a new screenshot.
    private var sourceURL: URL?

    func openScreenshot(at url: URL) {
        if let sourceURL, sourceURL != url { ScreenshotStore.remove(sourceURL) }
        sourceURL = url
        screen = .crop(url)
    }

    func startEditing(_ image: UIImage, drawings: [DrawingElement] = [], tool: Tool = .stepArrow) {
        screen = .edit(EditSession(image: image, drawings: drawings, tool: tool))
    }

    /// Back from the editor to the crop screen of the same screenshot.
    func recrop() {
        guard let sourceURL else { return cancel() }
        screen = .crop(sourceURL)
    }

    func finish() {
        discardSource()
        screen = .done
    }

    func cancel() {
        discardSource()
        screen = .home
    }

    private func discardSource() {
        if let sourceURL { ScreenshotStore.remove(sourceURL) }
        sourceURL = nil
    }
}

/// The cropped screenshot the editor works on, in points (its `scale` is the screen's).
struct EditSession: Equatable, Identifiable {
    let id = UUID()
    let image: UIImage
    /// Annotations and tool the editor starts with (only the debug demo scenes set them).
    var drawings: [DrawingElement] = []
    var tool: Tool = .stepArrow

    static func == (lhs: EditSession, rhs: EditSession) -> Bool { lhs.id == rhs.id }
}

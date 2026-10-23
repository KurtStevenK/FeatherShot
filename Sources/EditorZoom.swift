import CoreGraphics

/// How the editor scales the screenshot on screen. Exports are always 1:1, whatever the zoom.
/// The Electron editor (`electron-app/renderer/app.js`) uses the same levels and rules.
enum EditorZoom: Equatable {
    /// 1:1, shrunk to fit the window when the screenshot is bigger. Follows window resizes.
    case fit
    /// A fixed scale: 1 is the screenshot's original size.
    case scale(CGFloat)

    static let levels: [CGFloat] = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8]
    static let range: ClosedRange<CGFloat> = 0.1...8

    /// The scale that shows the whole image in `viewport`, never above 1:1.
    static func fitScale(image: CGSize, viewport: CGSize) -> CGFloat {
        guard image.width > 0, image.height > 0, viewport.width > 0, viewport.height > 0 else { return 1 }
        let ratio = min(viewport.width / image.width, viewport.height / image.height)
        return max(range.lowerBound, min(1, ratio))
    }

    func resolved(image: CGSize, viewport: CGSize) -> CGFloat {
        switch self {
        case .fit: return Self.fitScale(image: image, viewport: viewport)
        case .scale(let s): return Self.clamp(s)
        }
    }

    static func clamp(_ scale: CGFloat) -> CGFloat {
        min(range.upperBound, max(range.lowerBound, scale))
    }

    /// The next level above `scale`, or nil at the top.
    static func zoomedIn(from scale: CGFloat) -> CGFloat? {
        levels.first { $0 > scale + 0.001 }
    }

    /// The next level below `scale`, or nil at the bottom.
    static func zoomedOut(from scale: CGFloat) -> CGFloat? {
        levels.last { $0 < scale - 0.001 }
    }

    /// "100%", "67%": what the zoom control shows.
    static func percent(_ scale: CGFloat) -> String {
        "\(Int((scale * 100).rounded()))%"
    }
}

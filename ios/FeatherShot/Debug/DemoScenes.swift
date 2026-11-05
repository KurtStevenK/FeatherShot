#if DEBUG
import SwiftUI

/// Debug-only scenes for the App Store screenshots (packaging/ios/appstore/make_screenshots.sh):
/// `--open-screenshot <demo.png> --demo <scene>` opens the demo screen straight into a state.
/// Coordinates are in points of packaging/ios/appstore/demo_screen.swift (402×874), relative to the crop.
@MainActor
enum DemoScenes {
    /// The selection the crop screen starts with (`crop` scene).
    static var cropRect: CGRect?

    private static let red = EditorTheme.swatches[0], orange = EditorTheme.swatches[1]
    private static let yellow = EditorTheme.swatches[2], green = EditorTheme.swatches[3]
    private static let blue = EditorTheme.swatches[4], purple = EditorTheme.swatches[5]
    private static let white = EditorTheme.swatches[6]

    static func run(_ scene: String, sourceURL: URL, model: AppModel) {
        switch scene {
        case "crop":
            cropRect = CGRect(x: 14, y: 340, width: 374, height: 282)
        case "mixed":
            edit(sourceURL, model, crop: CGRect(x: 0, y: 118, width: 402, height: 580), tool: .circle, [
                el(.circle, (296, 20), (382, 58), yellow),
                DrawingElement(tool: .text, start: CGPoint(x: 110, y: 50), end: CGPoint(x: 110, y: 50),
                               color: white, lineWidth: 4, text: "Must see!", fontSize: 24),
                el(.stepArrow, (262, 198), (214, 240), red),
                el(.rectangle, (16, 300), (386, 367), blue),
                el(.magnifier, (349, 406), (393, 406), purple, zoom: 1.5),
                el(.questionArrow, (250, 548), (322, 500), orange),
            ])
        case "steps":
            edit(sourceURL, model, crop: CGRect(x: 0, y: 300, width: 402, height: 500), tool: .stepRectangle, [
                el(.stepRectangle, (24, 53), (380, 107), green),
                el(.stepRectangle, (24, 125), (380, 179), green),
                el(.stepRectangle, (24, 197), (380, 251), green),
                el(.stepRectangle, (24, 269), (380, 323), green),
                el(.abcArrow, (96, 470), (76, 422), blue),
                el(.abcArrow, (182, 462), (161, 392), blue),
                el(.abcArrow, (276, 472), (255, 416), blue),
                el(.abcArrow, (364, 452), (341, 382), blue),
            ])
        case "callouts":
            edit(sourceURL, model, crop: CGRect(x: 0, y: 118, width: 402, height: 580), tool: .exclamationArrow, [
                el(.questionArrow, (250, 96), (318, 50), yellow),
                el(.exclamationRectangle, (30, 140), (200, 166), red),
                el(.exclamationArrow, (262, 298), (330, 272), green),
                el(.questionRectangle, (20, 378), (382, 434), purple),
                el(.exclamationArrow, (250, 548), (325, 494), red),
            ])
        case "done":
            model.finish()
        default:
            break
        }
    }

    private static func el(_ tool: Tool, _ s: (CGFloat, CGFloat), _ e: (CGFloat, CGFloat), _ color: Color,
                           width: CGFloat = 4, zoom: CGFloat = 2) -> DrawingElement {
        DrawingElement(tool: tool, start: CGPoint(x: s.0, y: s.1), end: CGPoint(x: e.0, y: e.1),
                       color: color, lineWidth: width, zoomLevel: zoom)
    }

    private static func edit(_ url: URL, _ model: AppModel, crop: CGRect, tool: Tool, _ drawings: [DrawingElement]) {
        guard let image = ScreenshotImage.load(url, scale: 3),
              let cropped = ScreenshotImage.crop(image, to: crop) else { return }
        model.startEditing(cropped, drawings: drawings, tool: tool)
    }
}
#endif

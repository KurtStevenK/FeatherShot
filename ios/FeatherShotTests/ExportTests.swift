import Foundation
import SwiftUI
import Testing
import UIKit
@testable import FeatherShot

struct ExportTests {
    /// A screenshot of `width`×`height` pixels at `scale` (300×600 px at 3x is 100×200 points).
    private func screenshot(width: Int = 300, height: Int = 600, scale: CGFloat = 3) -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let px = UIGraphicsImageRenderer(size: CGSize(width: width, height: height), format: format).image { ctx in
            UIColor.systemTeal.setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
        }
        return UIImage(cgImage: px.cgImage!, scale: scale, orientation: .up)
    }

    @Test func cropKeepsFullPixelResolution() throws {
        let image = screenshot()
        #expect(image.size == CGSize(width: 100, height: 200))
        let cropped = try #require(ScreenshotImage.crop(image, to: CGRect(x: 10, y: 20, width: 50, height: 40)))
        #expect(cropped.scale == 3)
        #expect(cropped.cgImage?.width == 150)
        #expect(cropped.cgImage?.height == 120)
    }

    @MainActor
    @Test func annotatedRenderMatchesPixelSize() throws {
        let image = screenshot()
        let renderer = ImageRenderer(content: AnnotationLayer(image: image, drawings: [
            DrawingElement(tool: .stepArrow, start: CGPoint(x: 10, y: 10), end: CGPoint(x: 80, y: 150), color: .red, lineWidth: 4),
        ]))
        renderer.scale = image.scale
        let rendered = try #require(renderer.cgImage)
        #expect(rendered.width == 300)
        #expect(rendered.height == 600)
    }

    @Test func loadDecodesAtScreenScale() throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: dir) }
        let url = try ScreenshotStore.write(try #require(screenshot().pngData()), in: dir)
        let loaded = try #require(ScreenshotImage.load(url, scale: 3))
        #expect(loaded.size == CGSize(width: 100, height: 200))
        #expect(loaded.cgImage?.width == 300)
    }

    @Test func sweepKeepsFreshFilesAndRemovesOldOnes() throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: dir) }
        let fresh = try ScreenshotStore.write(Data([1]), in: dir)
        let old = try ScreenshotStore.write(Data([2]), in: dir)
        try FileManager.default.setAttributes(
            [.modificationDate: Date().addingTimeInterval(-7200)], ofItemAtPath: old.path
        )
        ScreenshotStore.sweep(in: dir)
        #expect(FileManager.default.fileExists(atPath: fresh.path))
        #expect(!FileManager.default.fileExists(atPath: old.path))
    }

    @Test func fileNameTimestampMatchesOtherPlatforms() {
        var components = DateComponents()
        components.calendar = Calendar(identifier: .gregorian)
        components.timeZone = .current
        components.year = 2026; components.month = 11; components.day = 5
        components.hour = 14; components.minute = 3; components.second = 27
        #expect(PhotoExport.timestamp(components.date!) == "2026-11-05_14-03-27")
    }

    @Test func fitScaleFillsThePhone() {
        #expect(FittingScrollView.fitScale(content: CGSize(width: 100, height: 50), in: CGSize(width: 400, height: 400)) == 4)
        #expect(FittingScrollView.fitScale(content: CGSize(width: 393, height: 852), in: CGSize(width: 393, height: 426)) == 0.5)
    }
}

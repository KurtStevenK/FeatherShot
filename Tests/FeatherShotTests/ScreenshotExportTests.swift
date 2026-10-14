import AppKit
import Foundation
import Testing
@testable import FeatherShot

/// A `pixels`-wide bitmap image whose point size reflects `scale`, like a Retina `screencapture` PNG.
private func captureImage(pixelsWide: Int, pixelsHigh: Int, scale: CGFloat) -> NSImage {
    let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: pixelsWide, pixelsHigh: pixelsHigh,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
    )!
    rep.size = NSSize(width: CGFloat(pixelsWide) / scale, height: CGFloat(pixelsHigh) / scale)
    let image = NSImage(size: rep.size)
    image.addRepresentation(rep)
    return image
}

private func bitmap(_ width: Int, _ height: Int) -> NSBitmapImageRep {
    let image = captureImage(pixelsWide: width, pixelsHigh: height, scale: 1)
    return image.representations.first as! NSBitmapImageRep
}

private func temporaryDirectory() throws -> URL {
    let url = FileManager.default.temporaryDirectory
        .appendingPathComponent("FeatherShotTests-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
}

private func privatePasteboard() -> NSPasteboard {
    NSPasteboard(name: NSPasteboard.Name("FeatherShotTests-\(UUID().uuidString)"))
}

private let fixedDate = Date(timeIntervalSince1970: 1_791_969_000)

@Test func timestampUsesFixedNumericFormat() {
    let stamp = ScreenshotExport.timestamp(fixedDate)
    #expect(stamp.range(of: #"^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$"#, options: .regularExpression) != nil)
}

@Test func saveDoesNotOverwriteCaptureFromSameSecond() throws {
    let dir = try temporaryDirectory()
    defer { try? FileManager.default.removeItem(at: dir) }
    let png = Data([0x89, 0x50, 0x4E, 0x47])

    let first = try ScreenshotExport.save(png: png, in: dir, date: fixedDate)
    let second = try ScreenshotExport.save(png: png, in: dir, date: fixedDate)

    #expect(first.lastPathComponent == "FeatherShot_\(ScreenshotExport.timestamp(fixedDate)).png")
    #expect(second.lastPathComponent == "FeatherShot_\(ScreenshotExport.timestamp(fixedDate))-2.png")
    #expect(try Data(contentsOf: second) == png)
}

@Test func copyPutsPNGAndTIFFOnPasteboard() throws {
    let pasteboard = privatePasteboard()
    defer { pasteboard.releaseGlobally() }
    let rep = bitmap(40, 20)
    let png = try #require(rep.representation(using: .png, properties: [:]))

    #expect(ScreenshotExport.copy(png: png, tiff: rep.tiffRepresentation, to: pasteboard))

    let pastedPNG = try #require(pasteboard.data(forType: .png))
    #expect(NSBitmapImageRep(data: pastedPNG)?.pixelsWide == 40)
    #expect(pasteboard.data(forType: .tiff) != nil)
}

@Test func failedSaveStillCopiesToClipboard() throws {
    let dir = try temporaryDirectory()
    defer { try? FileManager.default.removeItem(at: dir) }
    // A regular file where the Downloads folder should be makes the save fail.
    let notADirectory = dir.appendingPathComponent("Downloads")
    try Data().write(to: notADirectory)
    let pasteboard = privatePasteboard()
    defer { pasteboard.releaseGlobally() }

    let outcome = ScreenshotExport.perform(bitmap(8, 8), downloads: notADirectory, pasteboard: pasteboard, date: fixedDate)

    #expect(outcome.saveError != nil)
    #expect(outcome.savedURL == nil)
    #expect(outcome.copied)
    #expect(pasteboard.data(forType: .png) != nil)
}

@Test func performSavesAndCopiesSameImage() throws {
    let dir = try temporaryDirectory()
    defer { try? FileManager.default.removeItem(at: dir) }
    let pasteboard = privatePasteboard()
    defer { pasteboard.releaseGlobally() }

    let outcome = ScreenshotExport.perform(bitmap(30, 12), downloads: dir, pasteboard: pasteboard, date: fixedDate)

    let saved = try #require(outcome.savedURL)
    #expect(outcome.saveError == nil)
    #expect(outcome.copied)
    #expect(try Data(contentsOf: saved) == pasteboard.data(forType: .png))
}

@Test func pixelScaleMatchesCaptureDensity() {
    #expect(ScreenshotExport.pixelScale(of: captureImage(pixelsWide: 200, pixelsHigh: 100, scale: 2)) == 2)
    #expect(ScreenshotExport.pixelScale(of: captureImage(pixelsWide: 200, pixelsHigh: 100, scale: 1)) == 1)
    #expect(ScreenshotExport.pixelScale(of: NSImage(size: NSSize(width: 10, height: 10))) == nil)
}

@MainActor
@Test func editorRendersAtCaptureResolution() throws {
    let image = captureImage(pixelsWide: 320, pixelsHigh: 180, scale: 2)
    let view = AnnotationView(image: image) {}

    let rendered = try #require(view.renderBitmap())

    #expect(rendered.pixelsWide == 320)
    #expect(rendered.pixelsHigh == 180)
}

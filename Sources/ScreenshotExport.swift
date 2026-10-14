import AppKit

/// Saves the annotated screenshot to Downloads and copies it to the clipboard.
/// The two steps are independent: a failed save never skips the copy, and vice versa.
enum ScreenshotExport {
    struct Outcome {
        var savedURL: URL?
        var saveError: Error?
        var copied = false
    }

    static func perform(
        _ bitmap: NSBitmapImageRep,
        downloads: URL = downloadsDirectory(),
        pasteboard: NSPasteboard = .general,
        date: Date = Date()
    ) -> Outcome {
        var outcome = Outcome()
        guard let png = bitmap.representation(using: .png, properties: [:]) else {
            outcome.saveError = CocoaError(.fileWriteUnknown)
            return outcome
        }
        do {
            outcome.savedURL = try save(png: png, in: downloads, date: date)
        } catch {
            outcome.saveError = error
        }
        outcome.copied = copy(png: png, tiff: bitmap.tiffRepresentation, to: pasteboard)
        return outcome
    }

    /// In the App Store sandbox this is the container's Downloads link, which the
    /// `files.downloads.read-write` entitlement opens up to the real ~/Downloads.
    static func downloadsDirectory() -> URL {
        let fm = FileManager.default
        return fm.urls(for: .downloadsDirectory, in: .userDomainMask).first
            ?? fm.homeDirectoryForCurrentUser.appendingPathComponent("Downloads", isDirectory: true)
    }

    /// Writes `FeatherShot_<timestamp>.png`, adding `-2`, `-3`, … rather than overwriting
    /// another capture saved in the same second.
    static func save(png: Data, in directory: URL, date: Date) throws -> URL {
        let fm = FileManager.default
        try fm.createDirectory(at: directory, withIntermediateDirectories: true)
        let base = "FeatherShot_\(timestamp(date))"
        var url = directory.appendingPathComponent("\(base).png")
        var suffix = 2
        while fm.fileExists(atPath: url.path) {
            url = directory.appendingPathComponent("\(base)-\(suffix).png")
            suffix += 1
        }
        try png.write(to: url, options: .atomic)
        return url
    }

    /// PNG for current apps and browsers, TIFF for apps that only read the classic type.
    static func copy(png: Data, tiff: Data?, to pasteboard: NSPasteboard) -> Bool {
        let item = NSPasteboardItem()
        item.setData(png, forType: .png)
        if let tiff {
            item.setData(tiff, forType: .tiff)
        }
        pasteboard.clearContents()
        return pasteboard.writeObjects([item])
    }

    static func timestamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd_HH-mm-ss"
        return formatter.string(from: date)
    }

    /// Pixels per point of the captured image, so the export keeps the capture's resolution
    /// even when the main screen has a different backing scale.
    static func pixelScale(of image: NSImage) -> CGFloat? {
        let pixelsWide = image.representations.map(\.pixelsWide).max() ?? 0
        guard pixelsWide > 0, image.size.width > 0 else { return nil }
        return CGFloat(pixelsWide) / image.size.width
    }
}

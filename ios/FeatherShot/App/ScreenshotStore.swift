import Foundation

/// Temp files for incoming screenshots. Screenshots are sensitive, so each file is deleted as soon
/// as the user saves or cancels, and leftovers (a crash, a force quit) are swept at launch.
enum ScreenshotStore {
    static var directory: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Screenshots", isDirectory: true)
    }

    static func write(_ data: Data, in directory: URL = directory) throws -> URL {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let url = directory.appendingPathComponent("\(UUID().uuidString).img")
        try data.write(to: url, options: [.atomic, .completeFileProtectionUnlessOpen])
        return url
    }

    static func remove(_ url: URL) {
        try? FileManager.default.removeItem(at: url)
    }

    /// Deletes files older than `age` seconds (0: all of them).
    static func sweep(olderThan age: TimeInterval = 3600, in directory: URL = directory, now: Date = Date()) {
        let fm = FileManager.default
        guard let files = try? fm.contentsOfDirectory(
            at: directory, includingPropertiesForKeys: [.contentModificationDateKey]
        ) else { return }
        for file in files {
            let modified = (try? file.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate
            if let modified, now.timeIntervalSince(modified) < age { continue }
            try? fm.removeItem(at: file)
        }
    }
}

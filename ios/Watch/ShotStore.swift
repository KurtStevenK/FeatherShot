import Foundation
import Observation
import UIKit
import WatchConnectivity

/// One annotated screenshot received from the iPhone.
struct Shot: Identifiable, Hashable {
    let url: URL
    let date: Date
    var id: URL { url }
}

/// The screenshots on the watch: files in Documents/Shots, newest first, at most `limit`.
@MainActor @Observable
final class ShotStore {
    static let shared = ShotStore()
    static let limit = 20

    private(set) var shots: [Shot] = []
    private let receiver = Receiver()

    static var directory: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Shots", isDirectory: true)
    }

    init() {
        reload()
    }

    func activate() {
        receiver.onFile = { [weak self] in self?.reload() }
        receiver.activate()
    }

    func reload() {
        let fm = FileManager.default
        try? fm.createDirectory(at: Self.directory, withIntermediateDirectories: true)
        let files = (try? fm.contentsOfDirectory(at: Self.directory, includingPropertiesForKeys: [.contentModificationDateKey])) ?? []
        var found = files.compactMap { url -> Shot? in
            guard ["png", "jpg", "jpeg"].contains(url.pathExtension.lowercased()) else { return nil }
            let date = (try? url.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate ?? .distantPast
            return Shot(url: url, date: date)
        }
        found.sort { $0.date > $1.date }
        // Keep the newest; the watch has little room.
        for old in found.dropFirst(Self.limit) { try? fm.removeItem(at: old.url) }
        shots = Array(found.prefix(Self.limit))
    }

    func delete(_ shot: Shot) {
        try? FileManager.default.removeItem(at: shot.url)
        reload()
    }
}

/// Receives the files the iPhone sends. WatchConnectivity calls it off the main thread; the
/// received file must be moved before the delegate method returns.
private final class Receiver: NSObject, WCSessionDelegate, @unchecked Sendable {
    /// Set once on the main actor before `activate()`.
    nonisolated(unsafe) var onFile: (@MainActor () -> Void)?

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}

    func session(_ session: WCSession, didReceive file: WCSessionFile) {
        let fm = FileManager.default
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Shots", isDirectory: true)
        try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        let ext = file.fileURL.pathExtension.isEmpty ? "jpg" : file.fileURL.pathExtension
        let target = dir.appendingPathComponent("\(UUID().uuidString).\(ext)")
        do {
            try fm.moveItem(at: file.fileURL, to: target)
            if let seconds = file.metadata?["date"] as? Double {
                try? fm.setAttributes([.modificationDate: Date(timeIntervalSince1970: seconds)], ofItemAtPath: target.path)
            }
        } catch {
            return
        }
        let callback = onFile
        Task { @MainActor in callback?() }
    }
}

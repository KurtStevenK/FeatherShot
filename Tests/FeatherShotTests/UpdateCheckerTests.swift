import Foundation
import Testing
@testable import FeatherShot

/// An empty `FeatherShot.app` in a fresh temporary directory, laid out like the installed app.
private func makeAppBundle() throws -> URL {
    let app = FileManager.default.temporaryDirectory
        .appendingPathComponent("FeatherShotTests-\(UUID().uuidString)", isDirectory: true)
        .appendingPathComponent("FeatherShot.app", isDirectory: true)
    try FileManager.default.createDirectory(
        at: app.appendingPathComponent("Contents/MacOS", isDirectory: true),
        withIntermediateDirectories: true
    )
    return app
}

/// What the App Store and TestFlight install next to the app.
private func addStoreReceipt(to app: URL) throws {
    let receiptDirectory = app.appendingPathComponent("Contents/_MASReceipt", isDirectory: true)
    try FileManager.default.createDirectory(at: receiptDirectory, withIntermediateDirectories: true)
    try Data([0x30, 0x80]).write(to: receiptDirectory.appendingPathComponent("receipt"))
}

@Test func storeReceiptHidesUpdateCheck() throws {
    let app = try makeAppBundle()
    defer { try? FileManager.default.removeItem(at: app.deletingLastPathComponent()) }
    let bundle = try #require(Bundle(url: app))

    // Developer ID DMG / Homebrew: no receipt, not sandboxed.
    #expect(!UpdateChecker.isAppStoreBuild(bundle: bundle, sandboxed: false))

    try addStoreReceipt(to: app)
    #expect(UpdateChecker.isAppStoreBuild(bundle: bundle, sandboxed: false))
}

@Test func sandboxHidesUpdateCheckWithoutReceipt() throws {
    let app = try makeAppBundle()
    defer { try? FileManager.default.removeItem(at: app.deletingLastPathComponent()) }
    let bundle = try #require(Bundle(url: app))

    #expect(UpdateChecker.isAppStoreBuild(bundle: bundle, sandboxed: true))
}

@Test func testRunnerIsNotSandboxed() {
    #expect(!UpdateChecker.isSandboxed)
}

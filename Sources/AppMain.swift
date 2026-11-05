import SwiftUI
import AppKit
import CoreGraphics

@main
@MainActor
class AppDelegate: NSObject, NSApplicationDelegate {
    var statusItem: NSStatusItem?
    var contextMenu: NSMenu?
    /// Every open editor, so a second capture doesn't drop the reference to the first.
    var editorWindows: [NSWindow] = []

    /// NSApplication only holds its delegate weakly.
    private static var instance: AppDelegate?

    /// AppKit's default `NSApplicationDelegate.main()` only calls `NSApplicationMain`, which creates
    /// the delegate from a main nib. FeatherShot has no nib, so without this the delegate never
    /// exists: no menu bar item, and the app runs invisibly. No SwiftUI `App` scene either, so
    /// macOS has no empty placeholder or Settings window to open at launch.
    static func main() {
        let app = NSApplication.shared
        let delegate = AppDelegate()
        instance = delegate
        app.delegate = delegate
        app.setActivationPolicy(.accessory)
        app.run()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        print("FeatherShot starting...")

        // Ensure we are an accessory app (no Dock icon)
        NSApp.setActivationPolicy(.accessory)

        // Slightly delay setup to ensure the system is ready for the menu item
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            self.setupStatusItem()
            print("Status item setup called.")

            // CI launch check: the delegate ran, the menu bar item exists, and no window opened.
            if CommandLine.arguments.contains("--smoke-test") {
                let hasStatusItem = self.statusItem?.button != nil
                let strayWindows = NSApp.windows.filter { $0.isVisible && $0.styleMask.contains(.titled) }
                if hasStatusItem && strayWindows.isEmpty {
                    let menu = self.contextMenu?.items.filter { !$0.isSeparatorItem }.map(\.title) ?? []
                    print("Smoke test passed: status item ready, no windows open. Menu: \(menu.joined(separator: ", "))")
                    exit(0)
                }
                print("Smoke test failed: status item \(hasStatusItem ? "ready" : "missing"), open windows: \(strayWindows.map(\.title))")
                exit(1)
            }

            #if DEBUG
            // Test hook: `--open-editor <png>` opens the editor on an image file;
            // `--press-save` then presses Save & Copy and quits once the editor has closed.
            let args = CommandLine.arguments
            if let i = args.firstIndex(of: "--open-editor"), i + 1 < args.count {
                let window = self.showAnnotationWindow(imagePath: args[i + 1])
                if args.contains("--press-save") {
                    self.pressSaveForTesting(in: window)
                }
            }
            #endif
        }

        print("Initial launch steps complete.")
    }

    #if DEBUG
    private func pressSaveForTesting(in window: NSWindow?) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            print("Test hook: pressing Save & Copy")
            NotificationCenter.default.post(name: .featherShotPressSaveForTesting, object: nil)
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
                let closed = window?.isVisible == false
                print(closed ? "Test hook: editor closed after Save & Copy" : "Test hook: editor still open")
                exit(closed ? 0 : 1)
            }
        }
    }
    #endif

    func setupStatusItem() {
        print("Creating status item...")
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)

        // Prepare the context menu for right-click
        contextMenu = NSMenu()
        contextMenu?.addItem(NSMenuItem(title: "Take Screenshot", action: #selector(captureScreen), keyEquivalent: "s"))
        contextMenu?.addItem(NSMenuItem.separator())
        if UpdateChecker.isAvailable {
            contextMenu?.addItem(NSMenuItem(title: "Check for Updates…", action: #selector(checkForUpdates), keyEquivalent: ""))
        }
        let versionItem = NSMenuItem(title: "Version \(UpdateChecker.currentVersion)", action: nil, keyEquivalent: "")
        versionItem.isEnabled = false
        contextMenu?.addItem(versionItem)
        contextMenu?.addItem(NSMenuItem.separator())
        contextMenu?.addItem(NSMenuItem(title: "Quit", action: #selector(quitApp), keyEquivalent: "q"))

        if let button = statusItem?.button {
            // Using a simple text label for testing visibility
            button.title = "🪶"
            button.target = self
            button.action = #selector(statusItemClicked)

            // Allow the button to receive both left and right clicks
            button.sendAction(on: [.leftMouseUp, .rightMouseUp])
            print("Button configured with title 🪶")
        } else {
            print("Error: Could not find status item button!")
        }
    }

    @objc func statusItemClicked() {
        let event = NSApp.currentEvent

        // Check if it's a right click or a control-left click
        if event?.type == .rightMouseUp || (event?.modifierFlags.contains(.control) ?? false) {
            if let menu = contextMenu {
                // Temporarily attach the menu and trigger it
                statusItem?.menu = menu
                statusItem?.button?.performClick(nil)
                statusItem?.menu = nil // Detach immediately after use
            }
        } else {
            // It's a normal left click, execute take screenshot immediately
            captureScreen()
        }
    }

    @objc func quitApp() {
        NSApplication.shared.terminate(nil)
    }

    @objc func checkForUpdates() {
        UpdateChecker.checkForUpdates()
    }

    func showPermissionAlert() {
        let alert = NSAlert()
        alert.messageText = "Screen Recording Permission Required"
        alert.informativeText = "macOS requires you to grant FeatherShot permission to record the screen before taking screenshots.\n\n1. Open System Settings > Privacy & Security > Screen Recording.\n2. Remove any existing FeatherShot entries using the '-' button.\n3. Add or enable FeatherShot.\n4. Quit and reopen the app."
        alert.alertStyle = .warning
        alert.addButton(withTitle: "OK")

        NSApp.activate(ignoringOtherApps: true)
        alert.runModal()
    }

    @objc func captureScreen() {
        let hasAccess = CGPreflightScreenCaptureAccess()
        if !hasAccess {
            // Request access natively to trigger the system prompt if it hasn't been shown
            CGRequestScreenCaptureAccess()
        }

        let tempPath = FileManager.default.temporaryDirectory.appendingPathComponent("feathershot_temp.png").path

        // Remove old temp file to ensure we don't load a stale image
        try? FileManager.default.removeItem(atPath: tempPath)

        let capturePath = tempPath
        Task.detached(priority: .userInitiated) {
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
            // -i: interactive (select area)
            // -x: no sound
            process.arguments = ["-i", "-x", capturePath]

            do {
                try process.run()
                process.waitUntilExit()
            } catch {
                print("Error running screencapture: \(error)")
                return
            }

            let captured = FileManager.default.fileExists(atPath: capturePath)
            await MainActor.run {
                if captured {
                    self.showAnnotationWindow(imagePath: capturePath)
                } else if !CGPreflightScreenCaptureAccess() {
                    self.showPermissionAlert()
                }
            }
        }
    }

    @discardableResult
    func showAnnotationWindow(imagePath: String) -> NSWindow? {
        guard let nsImage = NSImage(contentsOfFile: imagePath) else { return nil }

        // Size the window for the screenshot at 1:1 plus the editor's bars; a screenshot bigger
        // than the screen opens fitted (the editor's default zoom) and can be zoomed to 1:1.
        let screenFrame = (NSScreen.main ?? NSScreen.screens.first)?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1200, height: 800)
        let margin = AnnotationView.canvasMargin
        let chromeHeight = AnnotationView.toolBarHeight + AnnotationView.actionBarHeight
        let maxWidth = screenFrame.width - 40
        let maxHeight = screenFrame.height - 40 - 28 // 28: the title bar above the content
        let minWidth = min(AnnotationView.minimumWidth, maxWidth)
        let windowWidth = min(max(nsImage.size.width + 2 * margin, minWidth), maxWidth)
        let windowHeight = min(max(nsImage.size.height + 2 * margin, 220) + chromeHeight, maxHeight)

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: windowWidth, height: windowHeight),
            styleMask: [.titled, .closable, .resizable, .miniaturizable],
            backing: .buffered,
            defer: false
        )
        window.center()
        window.title = "FeatherShot Editor"
        window.appearance = NSAppearance(named: .darkAqua)
        window.backgroundColor = NSColor(EditorTheme.bar)
        window.isReleasedWhenClosed = false
        window.delegate = self
        // Each editor closes itself, even when a newer capture opened another editor.
        window.contentView = NSHostingView(rootView: AnnotationView(image: nsImage) { [weak window] in
            window?.close()
        })
        window.makeKeyAndOrderFront(nil)
        window.level = .floating
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        // Narrow enough for small screens, wide enough that the bars never cut off Save & Copy.
        window.contentMinSize = NSSize(width: minWidth, height: chromeHeight + 160)

        editorWindows.append(window)
        NSApp.activate(ignoringOtherApps: true)
        return window
    }
}

extension AppDelegate: NSWindowDelegate {
    func windowWillClose(_ notification: Notification) {
        guard let window = notification.object as? NSWindow else { return }
        editorWindows.removeAll { $0 === window }
    }
}

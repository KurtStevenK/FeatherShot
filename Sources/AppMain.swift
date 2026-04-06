import SwiftUI
import AppKit
import CoreGraphics

@main
struct FeatherShotApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        // We still need a scene, but we don't want a window.
        // In macOS 13+, we can use Settings or a hidden window.
        Settings {
            EmptyView()
        }
    }
}

@MainActor
class AppDelegate: NSObject, NSApplicationDelegate {
    var statusItem: NSStatusItem?
    var contextMenu: NSMenu?
    var annotationWindow: NSWindow?

    func applicationDidFinishLaunching(_ notification: Notification) {
        print("FeatherShot starting...")
        
        // Ensure we are an accessory app (no Dock icon)
        NSApp.setActivationPolicy(.accessory)
        
        // Slightly delay setup to ensure the system is ready for the menu item
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            self.setupStatusItem()
            print("Status item setup called.")
        }
        
        print("Initial launch steps complete.")
    }

    func setupStatusItem() {
        print("Creating status item...")
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        
        // Prepare the context menu for right-click
        contextMenu = NSMenu()
        contextMenu?.addItem(NSMenuItem(title: "Take Screenshot", action: #selector(captureScreen), keyEquivalent: "s"))
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

        let tempPath = "/tmp/feathershot_temp.png"
        
        // Remove old temp file to ensure we don't load a stale image
        try? FileManager.default.removeItem(atPath: tempPath)
        
        Task {
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
            // -i: interactive (select area)
            // -x: no sound
            process.arguments = ["-i", "-x", tempPath]

            do {
                try process.run()
                process.waitUntilExit()

                if FileManager.default.fileExists(atPath: tempPath) {
                    // Success!
                    self.showAnnotationWindow(imagePath: tempPath)
                } else {
                    // Failed to create file. Could be user cancelled, or permission denied.
                    DispatchQueue.main.async {
                        if !CGPreflightScreenCaptureAccess() {
                            self.showPermissionAlert()
                        }
                    }
                }
            } catch {
                print("Error running screencapture: \(error)")
            }
        }
    }

    func showAnnotationWindow(imagePath: String) {
        guard let nsImage = NSImage(contentsOfFile: imagePath) else { return }

        let contentView = AnnotationView(image: nsImage) { @MainActor [weak self] finalImage in
            self?.copyToClipboard(image: finalImage)
            self?.annotationWindow?.close()
        }

        // Clamp window to visible screen to prevent buttons hiding behind toolbar
        let screenFrame = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1200, height: 800)
        let toolbarHeight: CGFloat = 60
        let padding: CGFloat = 40
        let maxWidth = screenFrame.width - padding
        let maxHeight = screenFrame.height - padding

        let windowWidth = min(max(nsImage.size.width, 600), maxWidth)
        let windowHeight = min(max(nsImage.size.height, 300) + toolbarHeight, maxHeight)

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: windowWidth, height: windowHeight),
            styleMask: [.titled, .closable, .resizable, .miniaturizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.center()
        window.title = "FeatherShot Editor"
        window.isReleasedWhenClosed = false
        window.contentView = NSHostingView(rootView: contentView)
        window.makeKeyAndOrderFront(nil)
        window.level = .floating
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden // Cleaner look
        window.minSize = NSSize(width: 600, height: 360)

        self.annotationWindow = window
        NSApp.activate(ignoringOtherApps: true)
    }

    func copyToClipboard(image: NSImage) {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.writeObjects([image])
    }
}

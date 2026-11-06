import PhotosUI
import SwiftUI

/// Shown when the app opens without a screenshot: how to put FeatherShot on the Action Button,
/// and a way to annotate a screenshot from Photos (which also works on iPhones without one).
struct HomeView: View {
    let model: AppModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                header
                OpenFromPhotosButton(model: model, title: "Annotate a Screenshot from Photos")
                setupSteps
            }
            .padding(20)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
        .scrollBounceBehavior(.basedOnSize)
    }

    private var header: some View {
        HStack(spacing: 14) {
            Image("Logo")
                .resizable()
                .frame(width: 56, height: 56)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text("FeatherShot")
                    .font(.title.weight(.bold))
                    .foregroundStyle(EditorTheme.text)
                Text("Screenshot, crop, annotate, share.")
                    .font(.subheadline)
                    .foregroundStyle(EditorTheme.muted)
            }
        }
        .padding(.top, 12)
    }

    /// The signed "Take Screenshot → Annotate Screenshot" shortcut, ready to share to Shortcuts.
    @State private var shortcutFile: URL?
    @State private var showGuide = false
    /// The guide opens by itself once, on the first launch.
    @AppStorage("setupGuideShown") private var setupGuideShown = false

    private var setupSteps: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(Device.isPad ? "Run FeatherShot from Control Center" : "Put FeatherShot on the Action Button")
                .font(.headline)
                .foregroundStyle(EditorTheme.text)
            step(1, "Add the **FeatherShot Screenshot** shortcut. The guide shows each tap.")
            if shortcutFile != nil {
                Button { showGuide = true } label: {
                    Label("Add the Shortcut", systemImage: "square.2.layers.3d")
                }
                .buttonStyle(EditorPillButtonStyle(kind: .ghost))
                .padding(.leading, 32)
            }
            if Device.isPad {
                step(2, "Open **Control Center**, tap **+ › Add a Control › Shortcut**, and choose **FeatherShot Screenshot**.")
                Text("Then tap it in any app: it takes a screenshot and FeatherShot opens to select the area. Siri runs it too: “FeatherShot Screenshot”.")
                    .font(.footnote)
                    .foregroundStyle(EditorTheme.muted)
            } else {
                step(2, "Open **Settings › Action Button**, swipe to **Shortcut**, and choose **FeatherShot Screenshot**.")
                Text("Then press the Action Button in any app: it takes a screenshot and FeatherShot opens to select the area. On iPhones without an Action Button, use **Settings › Accessibility › Touch › Back Tap** instead.")
                .font(.footnote)
                .foregroundStyle(EditorTheme.muted)
            }
            DisclosureGroup("Build the shortcut yourself") {
                VStack(alignment: .leading, spacing: 6) {
                    Text("In **Shortcuts**, create a shortcut with **Take Screenshot**, then **Annotate Screenshot** (FeatherShot).")
                    Button {
                        if let url = URL(string: "shortcuts://create-shortcut") {
                            UIApplication.shared.open(url)
                        }
                    } label: {
                        Label("Open Shortcuts", systemImage: "arrow.up.forward.app")
                    }
                    .font(.footnote.weight(.semibold))
                }
                .font(.footnote)
                .foregroundStyle(EditorTheme.muted)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 6)
            }
            .font(.footnote.weight(.medium))
            .tint(EditorTheme.link)
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(EditorTheme.card))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(EditorTheme.border))
        .task {
            shortcutFile = BundledShortcut.prepare()
            if !setupGuideShown, shortcutFile != nil {
                setupGuideShown = true
                showGuide = true
            }
        }
        .sheet(isPresented: $showGuide) {
            if let shortcutFile {
                SetupGuideView(shortcutFile: shortcutFile)
                    .presentationDragIndicator(.hidden)
            }
        }
    }

    private func step(_ number: Int, _ text: LocalizedStringKey) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text("\(number)")
                .font(.footnote.weight(.bold))
                .foregroundStyle(.white)
                .frame(width: 22, height: 22)
                .background(Circle().fill(EditorTheme.brand))
            Text(text)
                .font(.subheadline)
                .foregroundStyle(EditorTheme.text)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// The shortcut is bundled as `FeatherShot-Screenshot.signedshortcut` (no space in the source tree).
/// Shortcuts names an imported shortcut after its file, so it is shared as a temporary copy named
/// "FeatherShot Screenshot.shortcut".
enum BundledShortcut {
    static func prepare() -> URL? {
        guard let source = Bundle.main.url(forResource: "FeatherShot-Screenshot", withExtension: "signedshortcut") else {
            return nil
        }
        let fm = FileManager.default
        let folder = fm.temporaryDirectory.appendingPathComponent("Shortcut", isDirectory: true)
        let target = folder.appendingPathComponent("FeatherShot Screenshot.shortcut")
        do {
            try fm.createDirectory(at: folder, withIntermediateDirectories: true)
            if fm.fileExists(atPath: target.path) { try fm.removeItem(at: target) }
            try fm.copyItem(at: source, to: target)
            return target
        } catch {
            return nil
        }
    }
}

/// Picks an image in the system photo picker (no Photos permission needed) and opens it.
struct OpenFromPhotosButton: View {
    let model: AppModel
    let title: String
    var kind: EditorPillButtonStyle.Kind = .primary

    @State private var item: PhotosPickerItem?
    @State private var failed = false

    var body: some View {
        PhotosPicker(selection: $item, matching: .any(of: [.screenshots, .images])) {
            Label(title, systemImage: "photo.on.rectangle")
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(EditorPillButtonStyle(kind: kind))
        .onChange(of: item) { _, newItem in
            guard let newItem else { return }
            Task {
                defer { item = nil }
                guard let data = try? await newItem.loadTransferable(type: Data.self),
                      let url = try? ScreenshotStore.write(data) else {
                    failed = true
                    return
                }
                model.openScreenshot(at: url)
            }
        }
        .alert("Could not open the image", isPresented: $failed) {
            Button("OK", role: .cancel) {}
        }
    }
}

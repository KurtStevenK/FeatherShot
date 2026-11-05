import SwiftUI

@main
struct FeatherShotApp: App {
    init() {
        // Runs at process start, before an intent can hand over a file, so every file left
        // here is from an earlier run (a crash or a force quit) and can go.
        ScreenshotStore.sweep(olderThan: 0)
        #if DEBUG
        // Debug-only: `--open-screenshot <path>` opens an image as the Shortcut would, for
        // simulator checks (the simulator has no Action Button).
        let args = CommandLine.arguments
        if let i = args.firstIndex(of: "--open-screenshot"), i + 1 < args.count,
           let data = try? Data(contentsOf: URL(fileURLWithPath: args[i + 1])),
           let url = try? ScreenshotStore.write(data) {
            AppModel.shared.openScreenshot(at: url)
            // `--demo <scene>`: the App Store screenshot scenes (packaging/ios/appstore).
            if let d = args.firstIndex(of: "--demo"), d + 1 < args.count {
                DemoScenes.run(args[d + 1], sourceURL: url, model: AppModel.shared)
            }
        }
        #endif
    }

    var body: some Scene {
        WindowGroup {
            RootView(model: AppModel.shared)
                .preferredColorScheme(.dark)
                .tint(EditorTheme.blue)
        }
    }
}

struct RootView: View {
    let model: AppModel

    var body: some View {
        ZStack {
            EditorTheme.background.ignoresSafeArea()
            switch model.screen {
            case .home:
                HomeView(model: model)
            case .crop(let url):
                CropView(sourceURL: url, model: model)
                    .id(url)
            case .edit(let session):
                EditorView(image: session.image, model: model, initialDrawings: session.drawings, initialTool: session.tool)
                    .id(session.id)
            case .done:
                DoneView(model: model)
            }
        }
    }
}

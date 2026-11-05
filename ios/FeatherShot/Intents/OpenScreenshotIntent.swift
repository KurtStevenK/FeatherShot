import AppIntents
import UniformTypeIdentifiers

/// The Shortcuts action "Annotate Screenshot": the Action Button runs a shortcut that takes a
/// screenshot and passes it here. The intent opens the app on the crop screen.
struct OpenScreenshotIntent: AppIntent {
    static let title: LocalizedStringResource = "Annotate Screenshot"
    static let description = IntentDescription(
        "Opens a screenshot in FeatherShot to crop and annotate it. Put it after Take Screenshot."
    )
    static let openAppWhenRun = true

    /// The bundled "FeatherShot Screenshot" shortcut fills this by name: keep the name `screenshot`
    /// (or rebuild it with ios/Shortcut/build_shortcut.sh). Added by hand after Take Screenshot,
    /// Shortcuts connects the screenshot on its own.
    @Parameter(
        title: "Screenshot",
        supportedContentTypes: [.image],
        inputConnectionBehavior: .connectToPreviousIntentResult
    )
    var screenshot: IntentFile

    static var parameterSummary: some ParameterSummary {
        Summary("Annotate \(\.$screenshot) in FeatherShot")
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        let url = try ScreenshotStore.write(screenshot.data)
        AppModel.shared.openScreenshot(at: url)
        return .result()
    }
}

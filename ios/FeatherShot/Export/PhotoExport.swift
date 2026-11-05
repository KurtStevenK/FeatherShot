import Photos
import UIKit
import UniformTypeIdentifiers

/// Saves the annotated screenshot to Photos and copies it to the clipboard.
/// The two steps are independent, as on the Mac: a failed save never skips the copy.
enum PhotoExport {
    struct Outcome {
        var saveError: SaveError?
        var copied = false
    }

    enum SaveError: Error, Equatable {
        /// The user turned off "Add Photos Only" for FeatherShot.
        case notAllowed
        case failed(String)

        var message: String {
            switch self {
            case .notAllowed:
                return "FeatherShot may not add to Photos. Allow it in Settings › FeatherShot › Photos."
            case .failed(let reason):
                return "Could not save to Photos: \(reason)"
            }
        }
    }

    static func pngData(of image: UIImage) -> Data? {
        image.pngData()
    }

    @MainActor
    static func perform(png: Data, pasteboard: UIPasteboard = .general) async -> Outcome {
        var outcome = Outcome()
        copy(png: png, to: pasteboard)
        outcome.copied = true
        outcome.saveError = await saveToPhotos(png: png)
        return outcome
    }

    static func copy(png: Data, to pasteboard: UIPasteboard) {
        pasteboard.setData(png, forPasteboardType: UTType.png.identifier)
    }

    /// Add-only access: FeatherShot never reads the library.
    static func saveToPhotos(png: Data) async -> SaveError? {
        let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        guard status == .authorized || status == .limited else { return .notAllowed }
        do {
            try await PHPhotoLibrary.shared().performChanges {
                let request = PHAssetCreationRequest.forAsset()
                let options = PHAssetResourceCreationOptions()
                options.originalFilename = "FeatherShot_\(timestamp(Date())).png"
                request.addResource(with: .photo, data: png, options: options)
            }
            return nil
        } catch {
            return .failed(error.localizedDescription)
        }
    }

    /// Same naming as the Mac and Electron exports: `FeatherShot_2026-11-05_14-03-27.png`.
    static func timestamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd_HH-mm-ss"
        return formatter.string(from: date)
    }
}

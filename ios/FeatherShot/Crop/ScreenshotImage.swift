import UIKit
import ImageIO

enum ScreenshotImage {
    /// Longest side kept. Screenshots (at most ~2900 px) load at full size; a large camera photo
    /// picked from Photos is scaled down so the editor does not run out of memory.
    static let maxPixelSize = 4096

    /// Decodes the file upright, as an image in points at `scale` (the screen's), so a screenshot
    /// is as many points wide as the screen it came from and exports at its own pixel size.
    static func load(_ url: URL, scale: CGFloat) -> UIImage? {
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixelSize,
            kCGImageSourceShouldCacheImmediately: true,
        ]
        guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
        return UIImage(cgImage: cgImage, scale: max(1, scale), orientation: .up)
    }

    /// The part of `image` inside `rect` (points), cut at full pixel resolution.
    static func crop(_ image: UIImage, to rect: CGRect) -> UIImage? {
        guard let cgImage = image.cgImage else { return nil }
        let pixelRect = CropMath.pixelRect(
            rect, scale: image.scale,
            pixelSize: CGSize(width: cgImage.width, height: cgImage.height)
        )
        guard let cropped = cgImage.cropping(to: pixelRect) else { return nil }
        return UIImage(cgImage: cropped, scale: image.scale, orientation: .up)
    }
}

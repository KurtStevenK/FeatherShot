import AppKit
import CoreGraphics

func drawLinearGradient(context: CGContext, rect: CGRect, startColor: CGColor, endColor: CGColor) {
    let colors = [startColor, endColor] as CFArray
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let colorLocations: [CGFloat] = [0.0, 1.0]
    let gradient = CGGradient(colorsSpace: colorSpace, colors: colors, locations: colorLocations)!
    let startPoint = CGPoint(x: rect.minX, y: rect.maxY)
    let endPoint = CGPoint(x: rect.maxX, y: rect.minY)
    context.drawLinearGradient(gradient, start: startPoint, end: endPoint, options: [])
}

func drawIcon(whiteBackground: Bool, outputPath: String) {
    let size = CGSize(width: 1024, height: 1024)
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue
    guard let context = CGContext(data: nil, width: Int(size.width), height: Int(size.height), bitsPerComponent: 8, bytesPerRow: 0, space: colorSpace, bitmapInfo: bitmapInfo) else { return }

    let rect = CGRect(origin: .zero, size: size)
    let roundedPath = CGPath(roundedRect: rect, cornerWidth: 225, cornerHeight: 225, transform: nil)
    context.addPath(roundedPath)
    context.clip()

    if whiteBackground {
        context.setFillColor(CGColor(red: 1.0, green: 1.0, blue: 1.0, alpha: 1.0))
        context.fill(rect)
    } else {
        let startColor = CGColor(red: 0.05, green: 0.3, blue: 0.8, alpha: 1.0)
        let endColor = CGColor(red: 0.1, green: 0.8, blue: 0.8, alpha: 1.0)
        drawLinearGradient(context: context, rect: rect, startColor: startColor, endColor: endColor)
    }

    let nsContext = NSGraphicsContext(cgContext: context, flipped: false)
    NSGraphicsContext.current = nsContext

    let text = "🪶"
    let font = NSFont.systemFont(ofSize: 550)
    let attributes: [NSAttributedString.Key: Any] = [.font: font]
    let string = NSAttributedString(string: text, attributes: attributes)
    let stringSize = string.size()
    let stringRect = CGRect(
        x: (size.width - stringSize.width) / 2,
        y: (size.height - stringSize.height) / 2 - 20,
        width: stringSize.width,
        height: stringSize.height
    )

    let shadow = NSShadow()
    if whiteBackground {
        shadow.shadowColor = NSColor.black.withAlphaComponent(0.12)
        shadow.shadowBlurRadius = 24
        shadow.shadowOffset = NSSize(width: 0, height: -8)
    } else {
        shadow.shadowColor = NSColor.black.withAlphaComponent(0.4)
        shadow.shadowBlurRadius = 30
        shadow.shadowOffset = NSSize(width: 0, height: -20)
    }
    shadow.set()

    string.draw(in: stringRect)
    NSGraphicsContext.current = nil

    guard let cgImage = context.makeImage() else { return }
    let nsImage = NSImage(cgImage: cgImage, size: size)

    if let tiffData = nsImage.tiffRepresentation,
       let bitmapImage = NSBitmapImageRep(data: tiffData),
       let pngData = bitmapImage.representation(using: .png, properties: [:]) {
        let url = URL(fileURLWithPath: outputPath)
        try? pngData.write(to: url)
    }
}

func drawDmgBackground() {
    let size = CGSize(width: 600, height: 400)
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue
    guard let context = CGContext(data: nil, width: Int(size.width), height: Int(size.height), bitsPerComponent: 8, bytesPerRow: 0, space: colorSpace, bitmapInfo: bitmapInfo) else { return }

    let rect = CGRect(origin: .zero, size: size)

    let startColor = CGColor(red: 0.95, green: 0.96, blue: 0.98, alpha: 1.0)
    let endColor = CGColor(red: 0.88, green: 0.90, blue: 0.94, alpha: 1.0)
    drawLinearGradient(context: context, rect: rect, startColor: startColor, endColor: endColor)

    let nsContext = NSGraphicsContext(cgContext: context, flipped: false)
    NSGraphicsContext.current = nsContext

    let pstyleCenter = NSMutableParagraphStyle()
    pstyleCenter.alignment = .center

    let title = "FeatherShot"
    let titleFont = NSFont.systemFont(ofSize: 42, weight: .heavy)
    let titleAttr: [NSAttributedString.Key: Any] = [.font: titleFont, .foregroundColor: NSColor(white: 0.1, alpha: 1.0), .paragraphStyle: pstyleCenter]
    NSAttributedString(string: title, attributes: titleAttr).draw(in: CGRect(x: 0, y: 310, width: 600, height: 60))

    let subtitle = "Version 1.3.37"
    let subFont = NSFont.systemFont(ofSize: 18, weight: .medium)
    let subAttr: [NSAttributedString.Key: Any] = [.font: subFont, .foregroundColor: NSColor(white: 0.4, alpha: 1.0), .paragraphStyle: pstyleCenter]
    NSAttributedString(string: subtitle, attributes: subAttr).draw(in: CGRect(x: 0, y: 280, width: 600, height: 30))

    let instruct = "Drag to install"
    let instFont = NSFont.systemFont(ofSize: 16, weight: .bold)
    let instAttr: [NSAttributedString.Key: Any] = [.font: instFont, .foregroundColor: NSColor(white: 0.4, alpha: 1.0), .paragraphStyle: pstyleCenter]
    NSAttributedString(string: instruct, attributes: instAttr).draw(in: CGRect(x: 0, y: 150, width: 600, height: 30))

    let path = NSBezierPath()
    path.move(to: NSPoint(x: 250, y: 200))
    path.line(to: NSPoint(x: 350, y: 200))
    path.line(to: NSPoint(x: 340, y: 210))
    path.move(to: NSPoint(x: 350, y: 200))
    path.line(to: NSPoint(x: 340, y: 190))
    path.lineWidth = 3
    path.lineCapStyle = .round
    path.lineJoinStyle = .round
    NSColor(white: 0.7, alpha: 1.0).setStroke()
    path.stroke()

    let authorText = "Crafted by Kurt Steven Kainzmayer"
    let authorFont = NSFont.systemFont(ofSize: 14, weight: .regular)
    let authorAttr: [NSAttributedString.Key: Any] = [.font: authorFont, .foregroundColor: NSColor(white: 0.5, alpha: 1.0), .paragraphStyle: pstyleCenter]
    NSAttributedString(string: authorText, attributes: authorAttr).draw(in: CGRect(x: 0, y: 30, width: 600, height: 20))

    NSGraphicsContext.current = nil

    guard let cgImage = context.makeImage() else { return }
    let nsImage = NSImage(cgImage: cgImage, size: size)

    if let tiffData = nsImage.tiffRepresentation,
       let bitmapImage = NSBitmapImageRep(data: tiffData),
       let pngData = bitmapImage.representation(using: .png, properties: [:]) {
        try? pngData.write(to: URL(fileURLWithPath: "dmg_background.png"))
    }
}

drawIcon(whiteBackground: false, outputPath: "icon_1024.png")
drawIcon(whiteBackground: true, outputPath: "icon_1024_white.png")
drawDmgBackground()
print("Images generated successfully.")

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

func drawIcon() {
    let size = CGSize(width: 1024, height: 1024)
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue
    guard let context = CGContext(data: nil, width: Int(size.width), height: Int(size.height), bitsPerComponent: 8, bytesPerRow: 0, space: colorSpace, bitmapInfo: bitmapInfo) else { return }

    let rect = CGRect(origin: .zero, size: size)

    // Deep modern blue to cyan gradient
    let startColor = CGColor(red: 0.05, green: 0.3, blue: 0.8, alpha: 1.0)
    let endColor = CGColor(red: 0.1, green: 0.8, blue: 0.8, alpha: 1.0)
    
    // Draw rounded rect background
    let roundedPath = CGPath(roundedRect: rect, cornerWidth: 225, cornerHeight: 225, transform: nil)
    context.addPath(roundedPath)
    context.clip()
    drawLinearGradient(context: context, rect: rect, startColor: startColor, endColor: endColor)

    let nsContext = NSGraphicsContext(cgContext: context, flipped: false)
    NSGraphicsContext.current = nsContext
    
    // Draw Feather ONLY
    let text = "🪶"
    let font = NSFont.systemFont(ofSize: 550)
    let attributes: [NSAttributedString.Key: Any] = [
        .font: font
    ]
    let string = NSAttributedString(string: text, attributes: attributes)
    let stringSize = string.size()
    let stringRect = CGRect(
        x: (size.width - stringSize.width) / 2,
        y: (size.height - stringSize.height) / 2 - 20, // Center it nicely
        width: stringSize.width,
        height: stringSize.height
    )
    
    // Add shadow to the feather
    let shadow = NSShadow()
    shadow.shadowColor = NSColor.black.withAlphaComponent(0.4)
    shadow.shadowBlurRadius = 30
    shadow.shadowOffset = NSSize(width: 0, height: -20)
    shadow.set()
    
    string.draw(in: stringRect)

    NSGraphicsContext.current = nil

    guard let cgImage = context.makeImage() else { return }
    let nsImage = NSImage(cgImage: cgImage, size: size)
    
    if let tiffData = nsImage.tiffRepresentation,
       let bitmapImage = NSBitmapImageRep(data: tiffData),
       let pngData = bitmapImage.representation(using: .png, properties: [:]) {
        let url = URL(fileURLWithPath: "icon_1024.png")
        try? pngData.write(to: url)
    }
}

func drawDmgBackground() {
    let size = CGSize(width: 600, height: 400)
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue
    guard let context = CGContext(data: nil, width: Int(size.width), height: Int(size.height), bitsPerComponent: 8, bytesPerRow: 0, space: colorSpace, bitmapInfo: bitmapInfo) else { return }

    let rect = CGRect(origin: .zero, size: size)

    // Very light grey/white gradient for a bright, clean, modern macOS look
    // This ensures dark text is always legible and it looks native
    let startColor = CGColor(red: 0.95, green: 0.96, blue: 0.98, alpha: 1.0)
    let endColor = CGColor(red: 0.88, green: 0.90, blue: 0.94, alpha: 1.0)
    drawLinearGradient(context: context, rect: rect, startColor: startColor, endColor: endColor)
    
    let nsContext = NSGraphicsContext(cgContext: context, flipped: false)
    NSGraphicsContext.current = nsContext
    
    let pstyleCenter = NSMutableParagraphStyle()
    pstyleCenter.alignment = .center

    // Draw Title (Top Center)
    let title = "FeatherShot"
    let titleFont = NSFont.systemFont(ofSize: 42, weight: .heavy)
    let titleAttr: [NSAttributedString.Key: Any] = [.font: titleFont, .foregroundColor: NSColor(white: 0.1, alpha: 1.0), .paragraphStyle: pstyleCenter]
    let titleString = NSAttributedString(string: title, attributes: titleAttr)
    let titleRect = CGRect(x: 0, y: 310, width: 600, height: 60)
    titleString.draw(in: titleRect)
    
    // Draw Version
    let subtitle = "Version 1.2.0"
    let subFont = NSFont.systemFont(ofSize: 18, weight: .medium)
    let subAttr: [NSAttributedString.Key: Any] = [.font: subFont, .foregroundColor: NSColor(white: 0.4, alpha: 1.0), .paragraphStyle: pstyleCenter]
    let subString = NSAttributedString(string: subtitle, attributes: subAttr)
    let subRect = CGRect(x: 0, y: 280, width: 600, height: 30)
    subString.draw(in: subRect)

    // Draw Arrow Instruction (Below the icons)
    let instruct = "Drag to install"
    let instFont = NSFont.systemFont(ofSize: 16, weight: .bold)
    let instAttr: [NSAttributedString.Key: Any] = [.font: instFont, .foregroundColor: NSColor(white: 0.4, alpha: 1.0), .paragraphStyle: pstyleCenter]
    let instString = NSAttributedString(string: instruct, attributes: instAttr)
    let instRect = CGRect(x: 0, y: 150, width: 600, height: 30)
    instString.draw(in: instRect)
    
    // Draw a decorative arrow exactly between the left icon and the right folder
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

    // Draw Author (Bottom Center)
    let authorText = "Crafted by Kurt Steven Kainzmayer"
    let authorFont = NSFont.systemFont(ofSize: 14, weight: .regular)
    let authorAttr: [NSAttributedString.Key: Any] = [.font: authorFont, .foregroundColor: NSColor(white: 0.5, alpha: 1.0), .paragraphStyle: pstyleCenter]
    let authorString = NSAttributedString(string: authorText, attributes: authorAttr)
    let authorRect = CGRect(x: 0, y: 30, width: 600, height: 20)
    authorString.draw(in: authorRect)
    
    NSGraphicsContext.current = nil

    guard let cgImage = context.makeImage() else { return }
    let nsImage = NSImage(cgImage: cgImage, size: size)
    
    if let tiffData = nsImage.tiffRepresentation,
       let bitmapImage = NSBitmapImageRep(data: tiffData),
       let pngData = bitmapImage.representation(using: .png, properties: [:]) {
        let url = URL(fileURLWithPath: "dmg_background.png")
        try? pngData.write(to: url)
    }
}

drawIcon()
drawDmgBackground()
print("Images generated successfully.")

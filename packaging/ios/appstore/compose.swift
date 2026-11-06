// Composes the App Store screenshots in the style of the Mac set (_archive/appstore): the
// navy → purple → blue gradient, a white headline, a lavender subtitle, and the app in a device
// frame. No alpha channel. The canvas is exactly the size App Store Connect lists for the device:
//
//   swift compose.swift <shots-dir> <out-dir> <width> <height> <phone|duo|ipad>
//
//   iPhone (Dynamic Island, 6.1"/6.3"):  1206 2622 phone
//   iPhone Duo:                           2007 2853 duo   (or 1398 2034)
//   iPad 13":                             2064 2752 ipad
import AppKit
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count >= 6, let w = Double(args[3]), let h = Double(args[4]) else {
    fatalError("usage: compose.swift <shots-dir> <out-dir> <width> <height> <phone|duo|ipad>")
}
let canvas = CGSize(width: w, height: h)
let device = args[5]
/// Everything below was laid out on a 1320×2868 canvas; `u` scales it to this one.
let u = min(canvas.width / 1320, canvas.height / 2868)
/// Corner radius of the device outline, relative to its width.
let cornerRatio: CGFloat = device == "ipad" ? 0.055 : device == "duo" ? 0.085 : 0.145

struct Slide {
    let file: String
    let title: String
    let subtitle: String
}

var slides = [
    Slide(file: "mixed", title: "Annotate any screenshot\nin seconds",
          subtitle: "Arrows, shapes, text, magnifier\nand numbered markers"),
    Slide(file: "crop", title: "One press on the\nAction Button",
          subtitle: "It takes the screenshot,\nyou pick the area to keep"),
    Slide(file: "steps", title: "Number every step\nautomatically",
          subtitle: "Markers count up on their own:\n1, 2, 3 or a, b, c"),
    Slide(file: "callouts", title: "Point out exactly\nwhat matters",
          subtitle: "Callouts with ! and ? markers\nin any color"),
    Slide(file: "done", title: "Save & Copy\nin one tap",
          subtitle: "Straight to Photos\nand your clipboard"),
    Slide(file: "guide-3", title: "Free and\nopen source",
          subtitle: "No account, no tracking,\nno data collected"),
]

func color(_ hex: UInt32, _ alpha: CGFloat = 1) -> CGColor {
    CGColor(srgbRed: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255, alpha: alpha)
}

/// The Mac set's background: dark navy, purple glow top right, blue glow bottom left.
func drawBackground(_ ctx: CGContext) {
    let space = CGColorSpace(name: CGColorSpace.sRGB)!
    let base = CGGradient(colorsSpace: space, colors: [color(0x09112A), color(0x101535), color(0x143672)] as CFArray,
                          locations: [0, 0.45, 1])!
    ctx.drawLinearGradient(base, start: .zero, end: CGPoint(x: canvas.width, y: canvas.height), options: [])
    let purple = CGGradient(colorsSpace: space, colors: [color(0x5D47A5, 0.95), color(0x5D47A5, 0)] as CFArray, locations: [0, 1])!
    ctx.drawRadialGradient(purple, startCenter: CGPoint(x: canvas.width * 1.05, y: -80 * u), startRadius: 0,
                           endCenter: CGPoint(x: canvas.width * 1.05, y: -80 * u), endRadius: 1500 * max(u, canvas.width / 1320), options: [])
    let blue = CGGradient(colorsSpace: space, colors: [color(0x3374EA, 0.95), color(0x3374EA, 0)] as CFArray, locations: [0, 1])!
    ctx.drawRadialGradient(blue, startCenter: CGPoint(x: -120 * u, y: canvas.height + 60 * u), startRadius: 0,
                           endCenter: CGPoint(x: -120 * u, y: canvas.height + 60 * u), endRadius: 1700 * max(u, canvas.width / 1320), options: [])
}

/// Draws centered text; returns the bottom edge.
func drawText(_ text: String, font: NSFont, color: NSColor, top: CGFloat, lineSpacing: CGFloat) -> CGFloat {
    let style = NSMutableParagraphStyle()
    style.alignment = .center
    style.lineSpacing = lineSpacing
    let attributed = NSAttributedString(string: text, attributes: [.font: font, .foregroundColor: color, .paragraphStyle: style])
    let width = canvas.width - 140 * u
    let bounds = attributed.boundingRect(with: CGSize(width: width, height: 4000), options: [.usesLineFragmentOrigin, .usesFontLeading])
    attributed.draw(with: CGRect(x: 70 * u, y: top, width: width, height: ceil(bounds.height)), options: [.usesLineFragmentOrigin, .usesFontLeading])
    return top + ceil(bounds.height)
}

/// The capture inside a simple device outline, with the Mac set's soft shadow and blue glow.
func drawPhone(_ shot: NSImage, top: CGFloat, bottom: CGFloat) {
    let bezel: CGFloat = 28 * u
    var screenHeight = bottom - top - 2 * bezel
    var screenWidth = screenHeight * shot.size.width / shot.size.height
    let maxWidth = canvas.width - 2 * 110 * u - 2 * bezel
    if screenWidth > maxWidth {
        screenWidth = maxWidth
        screenHeight = screenWidth * shot.size.height / shot.size.width
    }
    let frame = CGRect(x: (canvas.width - screenWidth) / 2 - bezel, y: top, width: screenWidth + 2 * bezel, height: screenHeight + 2 * bezel)
    let outerRadius = frame.width * cornerRatio
    let body = NSBezierPath(roundedRect: frame, xRadius: outerRadius, yRadius: outerRadius)

    NSGraphicsContext.saveGraphicsState()
    let glow = NSShadow()
    glow.shadowColor = NSColor(srgbRed: 0.0, green: 0.4, blue: 1.0, alpha: 0.35)
    glow.shadowBlurRadius = 120 * u
    glow.set()
    NSColor(srgbRed: 0.07, green: 0.07, blue: 0.09, alpha: 1).setFill()
    body.fill()
    NSGraphicsContext.restoreGraphicsState()

    NSGraphicsContext.saveGraphicsState()
    let shadow = NSShadow()
    shadow.shadowColor = NSColor(white: 0, alpha: 0.6)
    shadow.shadowBlurRadius = 70 * u
    shadow.shadowOffset = NSSize(width: 0, height: -36 * u)
    shadow.set()
    NSColor(srgbRed: 0.07, green: 0.07, blue: 0.09, alpha: 1).setFill()
    body.fill()
    NSGraphicsContext.restoreGraphicsState()

    NSColor(white: 1, alpha: 0.16).setStroke()
    body.lineWidth = 3 * u
    body.stroke()

    let screen = frame.insetBy(dx: bezel, dy: bezel)
    NSGraphicsContext.saveGraphicsState()
    NSBezierPath(roundedRect: screen, xRadius: outerRadius - bezel, yRadius: outerRadius - bezel).addClip()
    shot.draw(in: screen, from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: [.interpolation: NSImageInterpolation.high])
    NSGraphicsContext.restoreGraphicsState()
}

// iPad has no Action Button: the shortcut runs from Control Center.
if device == "ipad" {
    slides[1] = Slide(file: "crop", title: "One tap from\nControl Center", subtitle: "It takes the screenshot,\nyou pick the area to keep")
}

/// One headline size for all slides: the largest at which every manual line fits on one line.
func fittingSize(_ texts: [String], weight: NSFont.Weight, start: CGFloat, width: CGFloat) -> CGFloat {
    var size = start
    while size > 20 {
        let font = NSFont.systemFont(ofSize: size, weight: weight)
        let widest = texts.flatMap { $0.components(separatedBy: "\n") }
            .map { NSAttributedString(string: $0, attributes: [.font: font]).size().width }.max() ?? 0
        if widest <= width { return size }
        size -= 2
    }
    return size
}
let titleSize = fittingSize(slides.map(\.title), weight: .bold, start: 112 * u, width: canvas.width - 160 * u)
let subtitleSize = fittingSize(slides.map(\.subtitle), weight: .regular, start: 54 * u, width: canvas.width - 160 * u)

let shotsDir = URL(fileURLWithPath: args[1])
let outDir = URL(fileURLWithPath: args[2])
try FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)

for (index, slide) in slides.enumerated() {
    guard let shot = NSImage(contentsOf: shotsDir.appendingPathComponent("\(slide.file).png")) else {
        fatalError("missing \(slide.file).png")
    }
    let ctx = CGContext(data: nil, width: Int(canvas.width), height: Int(canvas.height), bitsPerComponent: 8, bytesPerRow: 0,
                        space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    // Top-left origin, like the layout numbers below.
    ctx.translateBy(x: 0, y: canvas.height)
    ctx.scaleBy(x: 1, y: -1)
    NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: true)

    drawBackground(ctx)
    let titleBottom = drawText(slide.title, font: .systemFont(ofSize: titleSize, weight: .bold), color: .white, top: 190 * u, lineSpacing: 4 * u)
    let subtitleBottom = drawText(slide.subtitle, font: .systemFont(ofSize: subtitleSize, weight: .regular),
                                  color: NSColor(srgbRed: 0.72, green: 0.76, blue: 0.93, alpha: 1), top: titleBottom + 44 * u, lineSpacing: 8 * u)
    drawPhone(shot, top: subtitleBottom + 110 * u, bottom: canvas.height - 120 * u)

    NSGraphicsContext.current = nil
    let url = outDir.appendingPathComponent(String(format: "%02d.png", index + 1))
    let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(dest, ctx.makeImage()!, nil)
    CGImageDestinationFinalize(dest)
    print(url.lastPathComponent, "—", slide.title.replacingOccurrences(of: "\n", with: " "), "(\(Int(titleSize)) pt)")
}

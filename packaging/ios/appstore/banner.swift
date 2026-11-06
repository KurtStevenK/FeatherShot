// The product page header ("Kopfzeile") in App Store Connect: the Mac set's gradient, the logo and
// headline on the left, three iPhone screens on the right. No alpha channel.
//
//   swift banner.swift <iphone-shots-dir> <logo.png> <out.png> <width> <height>
//
// App Store Connect accepts 3840×1646 and 5244×2950.
import AppKit
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count >= 6, let w = Double(args[4]), let h = Double(args[5]) else {
    fatalError("usage: banner.swift <iphone-shots-dir> <logo.png> <out.png> <width> <height>")
}
let size = CGSize(width: w, height: h)
let shots = URL(fileURLWithPath: args[1])
let logo = NSImage(contentsOfFile: args[2])!
/// Layout unit: 1 at 3840×1646.
let u = min(size.width / 3840, size.height / 1646)

func color(_ hex: UInt32, _ alpha: CGFloat = 1) -> CGColor {
    CGColor(srgbRed: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255, alpha: alpha)
}

let ctx = CGContext(data: nil, width: Int(size.width), height: Int(size.height), bitsPerComponent: 8, bytesPerRow: 0,
                    space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
ctx.translateBy(x: 0, y: size.height)
ctx.scaleBy(x: 1, y: -1)
NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: true)

// Background, as in the screenshots.
let space = CGColorSpace(name: CGColorSpace.sRGB)!
ctx.drawLinearGradient(CGGradient(colorsSpace: space, colors: [color(0x09112A), color(0x101535), color(0x143672)] as CFArray, locations: [0, 0.5, 1])!,
                       start: .zero, end: CGPoint(x: size.width, y: size.height), options: [])
ctx.drawRadialGradient(CGGradient(colorsSpace: space, colors: [color(0x5D47A5, 0.9), color(0x5D47A5, 0)] as CFArray, locations: [0, 1])!,
                       startCenter: CGPoint(x: size.width, y: 0), startRadius: 0,
                       endCenter: CGPoint(x: size.width, y: 0), endRadius: size.width * 0.55, options: [])
ctx.drawRadialGradient(CGGradient(colorsSpace: space, colors: [color(0x3374EA, 0.85), color(0x3374EA, 0)] as CFArray, locations: [0, 1])!,
                       startCenter: CGPoint(x: 0, y: size.height), startRadius: 0,
                       endCenter: CGPoint(x: 0, y: size.height), endRadius: size.width * 0.5, options: [])

// Left: logo, name, headline, subtitle — vertically centered.
let left = size.width * 0.09
let iconSize = 190 * u
let headline = NSMutableAttributedString()
let headFont = NSFont.systemFont(ofSize: 150 * u, weight: .heavy)
headline.append(NSAttributedString(string: "Screenshot.\n", attributes: [.font: headFont, .foregroundColor: NSColor.white]))
headline.append(NSAttributedString(string: "Annotate.\n", attributes: [.font: headFont, .foregroundColor: NSColor(srgbRed: 0.10, green: 0.62, blue: 1.0, alpha: 1)]))
headline.append(NSAttributedString(string: "Share.", attributes: [.font: headFont, .foregroundColor: NSColor.white]))
let headStyle = NSMutableParagraphStyle(); headStyle.lineHeightMultiple = 0.92
headline.addAttribute(.paragraphStyle, value: headStyle, range: NSRange(location: 0, length: headline.length))
let subtitle = NSAttributedString(string: "Press the Action Button, pick the area,\nmark it up, Save & Copy.",
                                  attributes: [.font: NSFont.systemFont(ofSize: 62 * u, weight: .regular),
                                               .foregroundColor: NSColor(srgbRed: 0.72, green: 0.76, blue: 0.93, alpha: 1)])
let textWidth = size.width * 0.42
let headBounds = headline.boundingRect(with: CGSize(width: textWidth, height: size.height), options: [.usesLineFragmentOrigin])
let subBounds = subtitle.boundingRect(with: CGSize(width: textWidth, height: size.height), options: [.usesLineFragmentOrigin])
let blockHeight = iconSize + 70 * u + ceil(headBounds.height) + 50 * u + ceil(subBounds.height)
var y = (size.height - blockHeight) / 2

NSGraphicsContext.saveGraphicsState()
NSBezierPath(roundedRect: CGRect(x: left, y: y, width: iconSize, height: iconSize), xRadius: iconSize * 0.225, yRadius: iconSize * 0.225).addClip()
logo.draw(in: CGRect(x: left, y: y, width: iconSize, height: iconSize), from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: nil)
NSGraphicsContext.restoreGraphicsState()
let name = NSAttributedString(string: "FeatherShot", attributes: [.font: NSFont.systemFont(ofSize: 96 * u, weight: .bold), .foregroundColor: NSColor.white])
name.draw(at: CGPoint(x: left + iconSize + 50 * u, y: y + (iconSize - name.size().height) / 2))
y += iconSize + 70 * u
headline.draw(with: CGRect(x: left, y: y, width: textWidth, height: ceil(headBounds.height)), options: [.usesLineFragmentOrigin])
y += ceil(headBounds.height) + 50 * u
subtitle.draw(with: CGRect(x: left, y: y, width: textWidth, height: ceil(subBounds.height)), options: [.usesLineFragmentOrigin])

// Right: three phones, the middle one in front.
func phone(_ file: String, centerX: CGFloat, height: CGFloat, top: CGFloat) {
    guard let shot = NSImage(contentsOf: shots.appendingPathComponent("\(file).png")) else { fatalError("missing \(file).png") }
    let bezel = 22 * u * (height / (1360 * u))
    let screenH = height - 2 * bezel
    let screenW = screenH * shot.size.width / shot.size.height
    let frame = CGRect(x: centerX - screenW / 2 - bezel, y: top, width: screenW + 2 * bezel, height: height)
    let r = frame.width * 0.145
    let body = NSBezierPath(roundedRect: frame, xRadius: r, yRadius: r)
    NSGraphicsContext.saveGraphicsState()
    let shadow = NSShadow()
    shadow.shadowColor = NSColor(white: 0, alpha: 0.55); shadow.shadowBlurRadius = 80 * u; shadow.shadowOffset = NSSize(width: 0, height: -30 * u)
    shadow.set()
    NSColor(srgbRed: 0.07, green: 0.07, blue: 0.09, alpha: 1).setFill(); body.fill()
    NSGraphicsContext.restoreGraphicsState()
    NSColor(white: 1, alpha: 0.16).setStroke(); body.lineWidth = 3 * u; body.stroke()
    let screen = frame.insetBy(dx: bezel, dy: bezel)
    NSGraphicsContext.saveGraphicsState()
    NSBezierPath(roundedRect: screen, xRadius: r - bezel, yRadius: r - bezel).addClip()
    shot.draw(in: screen, from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: [.interpolation: NSImageInterpolation.high])
    NSGraphicsContext.restoreGraphicsState()
}
// As tall as the canvas allows, but the right phone must stay 4% inside the right edge:
// its edge is midX + 0.40·frontH + half a back phone (0.88·frontH·0.46/2 ≈ 0.20·frontH).
let frontH = min(size.height * 0.84, size.width * (1 - 0.72 - 0.04) / 0.61)
let backH = frontH * 0.88
let midX = size.width * 0.72
let spread = frontH * 0.40
phone("steps", centerX: midX - spread, height: backH, top: (size.height - backH) / 2 + 30 * u)
phone("callouts", centerX: midX + spread, height: backH, top: (size.height - backH) / 2 + 30 * u)
phone("mixed", centerX: midX, height: frontH, top: (size.height - frontH) / 2)

NSGraphicsContext.current = nil
let out = URL(fileURLWithPath: args[3])
let dest = CGImageDestinationCreateWithURL(out as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, ctx.makeImage()!, nil)
CGImageDestinationFinalize(dest)
print(out.lastPathComponent, Int(size.width), "×", Int(size.height))

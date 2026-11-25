import SwiftUI
#if canImport(AppKit)
import AppKit
/// The screenshot type: `NSImage` on the Mac, `UIImage` in the iOS app (which compiles this file too).
typealias PlatformImage = NSImage
#else
import UIKit
typealias PlatformImage = UIImage
#endif

enum Tool {
    case stepArrow, stepRectangle, arrow, rectangle, circle, line, dashedLine
    case questionArrow, questionRectangle, abcArrow, abcRectangle
    case exclamationArrow, exclamationRectangle
    case magnifier, text
}

struct DrawingElement: Identifiable {
    let id = UUID()
    let tool: Tool
    var start: CGPoint
    var end: CGPoint
    let color: Color
    let lineWidth: CGFloat
    var zoomLevel: CGFloat = 2.0
    var text: String = ""
    var fontSize: CGFloat = 24
}

// MARK: - Text annotations

/// Rules of the Text tool, shared by the Mac and iPhone editors.
enum TextAnnotation {
    /// Faint prompt of a new, empty text; it is never part of the annotation.
    static let placeholder = "Type here"

    static func fontSize(lineWidth: CGFloat) -> CGFloat { max(18, lineWidth * 5) }

    /// What ending an edit did to the text.
    enum Outcome: Equatable { case kept, removed, notFound }

    /// Ends editing text `id`: it keeps its trimmed text, or is removed when nothing is left,
    /// so a click that was never typed into does not leave an invisible annotation behind.
    @discardableResult
    static func commit(_ id: UUID, in drawings: inout [DrawingElement]) -> Outcome {
        guard let index = drawings.firstIndex(where: { $0.id == id }) else { return .notFound }
        let trimmed = drawings[index].text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            drawings.remove(at: index)
            return .removed
        }
        drawings[index].text = trimmed
        return .kept
    }

    /// Roughly the area of a text, which is drawn centered at its `start`. An empty text is
    /// one being typed, which shows the placeholder.
    static func bounds(of drawing: DrawingElement) -> CGRect {
        let characters = drawing.text.isEmpty ? placeholder.count : drawing.text.count
        let width = max(80, CGFloat(characters) * drawing.fontSize * 0.55)
        let height = drawing.fontSize * 1.4
        return CGRect(x: drawing.start.x - width / 2, y: drawing.start.y - height / 2, width: width, height: height)
    }

    /// The text at `point`: the one being typed (`editing`) when the press is on its field,
    /// otherwise the topmost one. `slop` widens the target (a finger is less precise than a pointer).
    static func hit(in drawings: [DrawingElement], at point: CGPoint, slop: CGFloat = 0, editing: UUID? = nil) -> UUID? {
        // The open field is wider than its text (room for the caret); a press there stays in it.
        if let editing, let open = drawings.first(where: { $0.id == editing }),
           bounds(of: open).insetBy(dx: -(caretRoom(fontSize: open.fontSize) + slop), dy: -slop).contains(point) {
            return editing
        }
        return drawings.last { drawing in
            drawing.tool == .text && bounds(of: drawing).insetBy(dx: -slop, dy: -slop).contains(point)
        }?.id
    }

    /// Room on each side of the input field: the text is centered, so a new character grows
    /// it by half its width per side, and the field must not scroll before it widens.
    static func caretRoom(fontSize: CGFloat) -> CGFloat { fontSize * 0.35 + 2 }
}

extension View {
    /// Lays out a text annotation's input field exactly where its `Text` is drawn: an invisible
    /// copy of the text in the same font sizes it, with room for the caret, and a thin dashed
    /// outline shows where it is. Apply to a plain, center-aligned field in that font.
    func textAnnotationEditingFrame(text: String, fontSize: CGFloat) -> some View {
        Text(text.isEmpty ? TextAnnotation.placeholder : text)
            .font(.system(size: fontSize, weight: .semibold))
            .fixedSize()
            .opacity(0)
            .overlay {
                RoundedRectangle(cornerRadius: 2)
                    .stroke(style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                    .foregroundStyle(Color.white.opacity(0.55))
                    .padding(-4)
            }
            .padding(.horizontal, TextAnnotation.caretRoom(fontSize: fontSize))
            .overlay { self }
    }
}

// Convert a 1-based step number into a letter label: 1→a, 2→b, …, 26→z, 27→aa, 28→ab, …
// JS copies live in shared/letterLabel.js; cases in shared/letterLabel.cases.json.
func letterLabel(_ n: Int) -> String {
    var num = n - 1
    var result = ""
    repeat {
        result = String(Character(UnicodeScalar(97 + (num % 26))!)) + result
        num = num / 26 - 1
    } while num >= 0
    return result
}

struct RectangleShape: Shape {
    var start: CGPoint
    var end: CGPoint

    func path(in rect: CGRect) -> Path {
        let drawingRect = CGRect(
            x: min(start.x, end.x),
            y: min(start.y, end.y),
            width: abs(end.x - start.x),
            height: abs(end.y - start.y)
        )
        return Path(drawingRect)
    }
}

// A high-quality View that draws a filled arrowhead at the end of a line
struct ArrowView: View {
    var start: CGPoint
    var end: CGPoint
    var color: Color
    var lineWidth: CGFloat
    
    var body: some View {
        // Sharper, more elegant head
        let headLength = 12 + (lineWidth * 1.5)
        let headAngle = Angle.degrees(20) // Sharper angle
        
        let dx = end.x - start.x
        let dy = end.y - start.y
        let angle = atan2(dy, dx)
        
        let tip = end
        
        // Wings of the head
        let p1 = CGPoint(
            x: end.x - headLength * cos(angle + CGFloat(headAngle.radians)),
            y: end.y - headLength * sin(angle + CGFloat(headAngle.radians))
        )
        let p2 = CGPoint(
            x: end.x - headLength * cos(angle - CGFloat(headAngle.radians)),
            y: end.y - headLength * sin(angle - CGFloat(headAngle.radians))
        )
        
        // Barb (inset point) where the shaft connects
        // Deepening the notch makes it look less "blocky"
        let barb = CGPoint(
            x: end.x - (headLength * 0.8) * cos(angle),
            y: end.y - (headLength * 0.8) * sin(angle)
        )

        return ZStack {
            // Shaft
            Path { path in
                path.move(to: start)
                path.addLine(to: barb)
            }
            .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
            
            // Filled Head
            Path { path in
                path.move(to: tip)
                path.addLine(to: p1)
                path.addLine(to: barb)
                path.addLine(to: p2)
                path.closeSubpath()
            }
            .fill(color)
        }
    }
}

// Simple line tool — just a straight line, no arrowhead
struct LineView: View {
    var start: CGPoint
    var end: CGPoint
    var color: Color
    var lineWidth: CGFloat
    
    var body: some View {
        Path { path in
            path.move(to: start)
            path.addLine(to: end)
        }
        .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
    }
}

// Dashed line tool — a straight line like LineView, drawn in dashes (dash 3× and gap 2× the width)
struct DashedLineView: View {
    var start: CGPoint
    var end: CGPoint
    var color: Color
    var lineWidth: CGFloat
    
    var body: some View {
        Path { path in
            path.move(to: start)
            path.addLine(to: end)
        }
        .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round, dash: [lineWidth * 3, lineWidth * 2]))
    }
}

// View for drawing counting step arrows
struct StepArrowView: View {
    var start: CGPoint
    var end: CGPoint
    var color: Color
    var lineWidth: CGFloat
    var stepNumber: Int
    
    var body: some View {
        let radius = max(12.0, lineWidth * 3.0)
        
        ZStack(alignment: .topLeading) {
            // Arrow underneath
            ArrowView(start: start, end: end, color: color, lineWidth: lineWidth)
            
            // Number Circle on top of start point
            Circle()
                .fill(color)
                .frame(width: radius * 2, height: radius * 2)
                .position(x: start.x, y: start.y)
                
            // The number text
            Text("\(stepNumber)")
                .font(.system(size: radius * 1.2, weight: .bold, design: .rounded))
                .foregroundColor(.white)
                .position(x: start.x, y: start.y)
        }
    }
}

// View for drawing counting step rectangles
struct StepRectangleView: View {
    var start: CGPoint
    var end: CGPoint
    var color: Color
    var lineWidth: CGFloat
    var stepNumber: Int
    
    var body: some View {
        let radius = max(12.0, lineWidth * 3.0)
        let drawingRect = CGRect(
            x: min(start.x, end.x),
            y: min(start.y, end.y),
            width: abs(end.x - start.x),
            height: abs(end.y - start.y)
        )
        // Place the number circle at the top-left corner of the rectangle
        let circleX = drawingRect.minX
        let circleY = drawingRect.minY
        
        ZStack(alignment: .topLeading) {
            // Rectangle
            RectangleShape(start: start, end: end)
                .stroke(color, lineWidth: lineWidth)
            
            // Number Circle at top-left corner
            Circle()
                .fill(color)
                .frame(width: radius * 2, height: radius * 2)
                .position(x: circleX, y: circleY)
                
            // The number text
            Text("\(stepNumber)")
                .font(.system(size: radius * 1.2, weight: .bold, design: .rounded))
                .foregroundColor(.white)
                .position(x: circleX, y: circleY)
        }
    }
}

// View for drawing arrows with question mark
struct QuestionArrowView: View {
    var start: CGPoint
    var end: CGPoint
    var color: Color
    var lineWidth: CGFloat
    
    var body: some View {
        let radius = max(12.0, lineWidth * 3.0)
        
        ZStack(alignment: .topLeading) {
            ArrowView(start: start, end: end, color: color, lineWidth: lineWidth)
            
            Circle()
                .fill(color)
                .frame(width: radius * 2, height: radius * 2)
                .position(x: start.x, y: start.y)
                
            Text("?")
                .font(.system(size: radius * 1.2, weight: .bold, design: .rounded))
                .foregroundColor(.white)
                .position(x: start.x, y: start.y)
        }
    }
}

// View for drawing arrows with exclamation mark
struct ExclamationArrowView: View {
    var start: CGPoint
    var end: CGPoint
    var color: Color
    var lineWidth: CGFloat

    var body: some View {
        let radius = max(12.0, lineWidth * 3.0)

        ZStack(alignment: .topLeading) {
            ArrowView(start: start, end: end, color: color, lineWidth: lineWidth)

            Circle()
                .fill(color)
                .frame(width: radius * 2, height: radius * 2)
                .position(x: start.x, y: start.y)

            Text("!")
                .font(.system(size: radius * 1.2, weight: .bold, design: .rounded))
                .foregroundColor(.white)
                .position(x: start.x, y: start.y)
        }
    }
}

// View for drawing rectangles with exclamation mark
struct ExclamationRectangleView: View {
    var start: CGPoint
    var end: CGPoint
    var color: Color
    var lineWidth: CGFloat

    var body: some View {
        let radius = max(12.0, lineWidth * 3.0)
        let drawingRect = CGRect(
            x: min(start.x, end.x),
            y: min(start.y, end.y),
            width: abs(end.x - start.x),
            height: abs(end.y - start.y)
        )
        let circleX = drawingRect.minX
        let circleY = drawingRect.minY

        ZStack(alignment: .topLeading) {
            RectangleShape(start: start, end: end)
                .stroke(color, lineWidth: lineWidth)

            Circle()
                .fill(color)
                .frame(width: radius * 2, height: radius * 2)
                .position(x: circleX, y: circleY)

            Text("!")
                .font(.system(size: radius * 1.2, weight: .bold, design: .rounded))
                .foregroundColor(.white)
                .position(x: circleX, y: circleY)
        }
    }
}

// View for drawing rectangles with question mark
struct QuestionRectangleView: View {
    var start: CGPoint
    var end: CGPoint
    var color: Color
    var lineWidth: CGFloat
    
    var body: some View {
        let radius = max(12.0, lineWidth * 3.0)
        let drawingRect = CGRect(
            x: min(start.x, end.x),
            y: min(start.y, end.y),
            width: abs(end.x - start.x),
            height: abs(end.y - start.y)
        )
        let circleX = drawingRect.minX
        let circleY = drawingRect.minY
        
        ZStack(alignment: .topLeading) {
            RectangleShape(start: start, end: end)
                .stroke(color, lineWidth: lineWidth)
            
            Circle()
                .fill(color)
                .frame(width: radius * 2, height: radius * 2)
                .position(x: circleX, y: circleY)
                
            Text("?")
                .font(.system(size: radius * 1.2, weight: .bold, design: .rounded))
                .foregroundColor(.white)
                .position(x: circleX, y: circleY)
        }
    }
}

// View for drawing arrows with auto-incrementing letter label (a, b, …, z, aa, ab, …)
struct ABCArrowView: View {
    var start: CGPoint
    var end: CGPoint
    var color: Color
    var lineWidth: CGFloat
    var stepNumber: Int
    
    var body: some View {
        let radius = max(12.0, lineWidth * 3.0)
        let label = letterLabel(stepNumber)
        
        ZStack(alignment: .topLeading) {
            ArrowView(start: start, end: end, color: color, lineWidth: lineWidth)
            
            Circle()
                .fill(color)
                .frame(width: radius * 2, height: radius * 2)
                .position(x: start.x, y: start.y)
                
            Text(label)
                .font(.system(size: radius * (label.count > 1 ? 0.9 : 1.2), weight: .bold, design: .rounded))
                .foregroundColor(.white)
                .position(x: start.x, y: start.y)
        }
    }
}

// View for drawing rectangles with auto-incrementing letter label
struct ABCRectangleView: View {
    var start: CGPoint
    var end: CGPoint
    var color: Color
    var lineWidth: CGFloat
    var stepNumber: Int
    
    var body: some View {
        let radius = max(12.0, lineWidth * 3.0)
        let drawingRect = CGRect(
            x: min(start.x, end.x),
            y: min(start.y, end.y),
            width: abs(end.x - start.x),
            height: abs(end.y - start.y)
        )
        let circleX = drawingRect.minX
        let circleY = drawingRect.minY
        let label = letterLabel(stepNumber)
        
        ZStack(alignment: .topLeading) {
            RectangleShape(start: start, end: end)
                .stroke(color, lineWidth: lineWidth)
            
            Circle()
                .fill(color)
                .frame(width: radius * 2, height: radius * 2)
                .position(x: circleX, y: circleY)
                
            Text(label)
                .font(.system(size: radius * (label.count > 1 ? 0.9 : 1.2), weight: .bold, design: .rounded))
                .foregroundColor(.white)
                .position(x: circleX, y: circleY)
        }
    }
}

// Ellipse shape inscribed in the bounding rect from start to end
struct EllipseShape: Shape {
    var start: CGPoint
    var end: CGPoint

    func path(in rect: CGRect) -> Path {
        let drawingRect = CGRect(
            x: min(start.x, end.x),
            y: min(start.y, end.y),
            width: abs(end.x - start.x),
            height: abs(end.y - start.y)
        )
        return Path(ellipseIn: drawingRect)
    }
}

// Circle/Ellipse annotation tool — stroke only, no fill
struct EllipseView: View {
    var start: CGPoint
    var end: CGPoint
    var color: Color
    var lineWidth: CGFloat

    var body: some View {
        EllipseShape(start: start, end: end)
            .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
    }
}

// Magnifier tool — circular zoom lens showing magnified screenshot content
struct MagnifierView: View {
    var image: PlatformImage
    var start: CGPoint  // center of magnification
    var end: CGPoint    // defines radius via distance
    var color: Color
    var lineWidth: CGFloat
    var zoomLevel: CGFloat

    var body: some View {
        let dx = end.x - start.x
        let dy = end.y - start.y
        let radius = sqrt(dx * dx + dy * dy)
        
        if radius >= 5 {
            let srcRadius = radius / zoomLevel
            let srcRect = CGRect(
                x: start.x - srcRadius,
                y: start.y - srcRadius,
                width: srcRadius * 2,
                height: srcRadius * 2
            )
            
            ZStack {
                // Magnified image content clipped to circle
                if let croppedImage = Self.crop(image, to: srcRect) {
                    Self.swiftUIImage(croppedImage)
                        .resizable()
                        .frame(width: radius * 2, height: radius * 2)
                        .clipShape(Circle())
                        .position(x: start.x, y: start.y)
                }
                
                // Border ring
                Circle()
                    .stroke(color, lineWidth: max(3, lineWidth))
                    .frame(width: radius * 2, height: radius * 2)
                    .position(x: start.x, y: start.y)
                
                // Crosshair
                Path { path in
                    path.move(to: CGPoint(x: start.x - 6, y: start.y))
                    path.addLine(to: CGPoint(x: start.x + 6, y: start.y))
                    path.move(to: CGPoint(x: start.x, y: start.y - 6))
                    path.addLine(to: CGPoint(x: start.x, y: start.y + 6))
                }
                .stroke(color, lineWidth: 1.5)
            }
        }
    }
    
    /// Clamps `rect` (image points) to the image bounds; nil when nothing is left.
    static func clampedSourceRect(_ rect: CGRect, imageSize imgSize: CGSize) -> CGRect? {
        let clampedX = max(0, min(rect.origin.x, imgSize.width))
        let clampedY = max(0, min(rect.origin.y, imgSize.height))
        let clampedW = min(rect.width, imgSize.width - clampedX)
        let clampedH = min(rect.height, imgSize.height - clampedY)
        if clampedW <= 0 || clampedH <= 0 { return nil }
        return CGRect(x: clampedX, y: clampedY, width: clampedW, height: clampedH)
    }

    #if canImport(AppKit)
    private static func swiftUIImage(_ image: NSImage) -> Image { Image(nsImage: image) }

    // Crop an NSImage to a given CGRect
    private static func crop(_ nsImage: NSImage, to rect: CGRect) -> NSImage? {
        let imgSize = nsImage.size
        guard let cropRect = clampedSourceRect(rect, imageSize: imgSize) else { return nil }

        let result = NSImage(size: cropRect.size)
        result.lockFocus()
        // NSImage uses flipped coordinates — need to flip Y for drawing
        let flippedSrcY = imgSize.height - cropRect.origin.y - cropRect.height
        nsImage.draw(
            in: CGRect(origin: .zero, size: cropRect.size),
            from: CGRect(x: cropRect.origin.x, y: flippedSrcY, width: cropRect.width, height: cropRect.height),
            operation: .copy,
            fraction: 1.0
        )
        result.unlockFocus()
        return result
    }
    #else
    private static func swiftUIImage(_ image: UIImage) -> Image { Image(uiImage: image) }

    // Crop a UIImage (points, top-left origin) to a given CGRect
    private static func crop(_ uiImage: UIImage, to rect: CGRect) -> UIImage? {
        guard let cropRect = clampedSourceRect(rect, imageSize: uiImage.size),
              let cgImage = uiImage.cgImage else { return nil }
        let scale = uiImage.scale
        let pixelRect = CGRect(
            x: cropRect.minX * scale, y: cropRect.minY * scale,
            width: cropRect.width * scale, height: cropRect.height * scale
        ).integral
        guard let cropped = cgImage.cropping(to: pixelRect) else { return nil }
        return UIImage(cgImage: cropped, scale: scale, orientation: .up)
    }
    #endif
}

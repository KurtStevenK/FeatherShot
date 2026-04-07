import SwiftUI

enum Tool {
    case stepArrow, stepRectangle, arrow, rectangle, circle, line, questionArrow, questionRectangle, abcArrow, abcRectangle, magnifier
}

struct DrawingElement: Identifiable {
    let id = UUID()
    let tool: Tool
    let start: CGPoint
    let end: CGPoint
    let color: Color
    let lineWidth: CGFloat
    var zoomLevel: CGFloat = 2.0
}

// Convert a 1-based step number into a letter label: 1→a, 2→b, …, 26→z, 27→aa, 28→ab, …
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
    var image: NSImage
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
                if let croppedImage = cropNSImage(image, to: srcRect) {
                    Image(nsImage: croppedImage)
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
    
    // Crop an NSImage to a given CGRect
    private func cropNSImage(_ nsImage: NSImage, to rect: CGRect) -> NSImage? {
        let imgSize = nsImage.size
        // Clamp the rect to image bounds
        let clampedX = max(0, min(rect.origin.x, imgSize.width))
        let clampedY = max(0, min(rect.origin.y, imgSize.height))
        let clampedW = min(rect.width, imgSize.width - clampedX)
        let clampedH = min(rect.height, imgSize.height - clampedY)
        
        if clampedW <= 0 || clampedH <= 0 { return nil }
        
        let cropRect = CGRect(x: clampedX, y: clampedY, width: clampedW, height: clampedH)
        
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
}

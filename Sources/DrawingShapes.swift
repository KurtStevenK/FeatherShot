import SwiftUI

enum Tool {
    case stepArrow, stepRectangle, arrow, rectangle
}

struct DrawingElement: Identifiable {
    let id = UUID()
    let tool: Tool
    let start: CGPoint
    let end: CGPoint
    let color: Color
    let lineWidth: CGFloat
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

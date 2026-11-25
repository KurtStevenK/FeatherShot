import SwiftUI

/// The screenshot with its annotations, in image points. Used for both the canvas and the
/// export (`ImageRenderer` at the image's scale gives a 1:1 pixel copy).
/// Mirrors `drawingContent` in the Mac `AnnotationView`, using the shared shape views.
struct AnnotationLayer: View {
    let image: UIImage
    let drawings: [DrawingElement]
    /// The shape being dragged out right now, numbered after the finished ones.
    var active: DrawingElement?
    /// The text being typed, drawn as its input field instead of as text (never in the export).
    var textEditing: TextEditing?

    /// The text annotation open for typing on the canvas.
    struct TextEditing {
        let id: UUID
        let text: Binding<String>
        /// Return on the keyboard.
        let onDone: () -> Void
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            Image(uiImage: image)
                .resizable()
                .frame(width: image.size.width, height: image.size.height)

            ForEach(Array(drawings.enumerated()), id: \.element.id) { index, drawing in
                if let textEditing, textEditing.id == drawing.id {
                    AnnotationTextField(element: drawing, editing: textEditing)
                } else {
                    AnnotationShape(
                        element: drawing,
                        number: drawings[0...index].filter { $0.tool == drawing.tool }.count,
                        image: image
                    )
                }
            }

            if let active {
                AnnotationShape(
                    element: active,
                    number: drawings.filter { $0.tool == active.tool }.count + 1,
                    image: image
                )
            }
        }
        .frame(width: image.size.width, height: image.size.height, alignment: .topLeading)
        .clipped()
    }
}

/// The text being typed: an input field that looks like the finished text (same font, color
/// and center), so nothing moves when typing ends. It lives in the zoomed content, so it scales
/// with the canvas like the text does.
private struct AnnotationTextField: View {
    let element: DrawingElement
    let editing: AnnotationLayer.TextEditing
    // Owned here: the canvas content is hosted apart from the editor, so the editor's focus
    // state would not reach this field.
    @FocusState private var focused: Bool

    var body: some View {
        TextField(TextAnnotation.placeholder, text: editing.text)
            .textFieldStyle(.plain)
            .font(.system(size: element.fontSize, weight: .semibold))
            .foregroundStyle(element.color)
            .tint(element.color)
            .multilineTextAlignment(.center)
            .submitLabel(.done)
            .focused($focused)
            .onSubmit { editing.onDone() }
            .textAnnotationEditingFrame(text: element.text, fontSize: element.fontSize)
            .position(x: element.start.x, y: element.start.y)
            // Typing starts without another tap. Right after the field appears UIKit can still
            // refuse first responder, so ask once more after a moment.
            .task {
                focused = true
                try? await Task.sleep(for: .milliseconds(100))
                if !Task.isCancelled && !focused { focused = true }
            }
    }
}

/// One annotation. `number` is its position among annotations of the same tool (steps, ABC).
struct AnnotationShape: View {
    let element: DrawingElement
    let number: Int
    let image: UIImage

    var body: some View {
        let e = element
        switch e.tool {
        case .arrow:
            ArrowView(start: e.start, end: e.end, color: e.color, lineWidth: e.lineWidth)
        case .stepArrow:
            StepArrowView(start: e.start, end: e.end, color: e.color, lineWidth: e.lineWidth, stepNumber: number)
        case .stepRectangle:
            StepRectangleView(start: e.start, end: e.end, color: e.color, lineWidth: e.lineWidth, stepNumber: number)
        case .line:
            LineView(start: e.start, end: e.end, color: e.color, lineWidth: e.lineWidth)
        case .dashedLine:
            DashedLineView(start: e.start, end: e.end, color: e.color, lineWidth: e.lineWidth)
        case .questionArrow:
            QuestionArrowView(start: e.start, end: e.end, color: e.color, lineWidth: e.lineWidth)
        case .questionRectangle:
            QuestionRectangleView(start: e.start, end: e.end, color: e.color, lineWidth: e.lineWidth)
        case .exclamationArrow:
            ExclamationArrowView(start: e.start, end: e.end, color: e.color, lineWidth: e.lineWidth)
        case .exclamationRectangle:
            ExclamationRectangleView(start: e.start, end: e.end, color: e.color, lineWidth: e.lineWidth)
        case .abcArrow:
            ABCArrowView(start: e.start, end: e.end, color: e.color, lineWidth: e.lineWidth, stepNumber: number)
        case .abcRectangle:
            ABCRectangleView(start: e.start, end: e.end, color: e.color, lineWidth: e.lineWidth, stepNumber: number)
        case .circle:
            EllipseView(start: e.start, end: e.end, color: e.color, lineWidth: e.lineWidth)
        case .magnifier:
            MagnifierView(image: image, start: e.start, end: e.end, color: e.color, lineWidth: e.lineWidth, zoomLevel: e.zoomLevel)
        case .text:
            Text(e.text)
                .font(.system(size: e.fontSize, weight: .semibold))
                .foregroundColor(e.color)
                .fixedSize()
                .position(x: e.start.x, y: e.start.y)
        case .rectangle:
            RectangleShape(start: e.start, end: e.end)
                .stroke(e.color, lineWidth: e.lineWidth)
        }
    }
}

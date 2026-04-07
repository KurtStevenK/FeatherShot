import SwiftUI

struct AnnotationView: View {
    let image: NSImage
    let onComplete: @MainActor @Sendable (NSImage) -> Void

    @State private var drawings: [DrawingElement] = []
    @State private var currentStart: CGPoint?
    @State private var currentEnd: CGPoint?
    
    @State private var selectedTool: Tool = .stepArrow
    @State private var selectedColor: Color = .red
    @State private var lineWidth: CGFloat = 4.0
    @State private var zoomLevel: CGFloat = 2.0

    var body: some View {
        VStack(spacing: 0) {
            // Scrollable image area — allows large screenshots to scroll
            // instead of pushing the toolbar off-screen
            ScrollView([.horizontal, .vertical]) {
                ZStack(alignment: .center) {
                    Color.black.opacity(0.12)
                    
                    drawingContent
                        .frame(width: image.size.width, height: image.size.height)
                        .background(Color.white.opacity(0.05))
                        .overlay(
                            Rectangle()
                                .stroke(Color.white.opacity(0.3), lineWidth: 0.5)
                        )
                        .shadow(color: .black.opacity(0.2), radius: 10)
                        .contentShape(Rectangle())
                        .gesture(
                            DragGesture(minimumDistance: 0)
                                .onChanged { value in
                                    if currentStart == nil {
                                        currentStart = value.startLocation
                                    }
                                    currentEnd = value.location
                                }
                                .onEnded { value in
                                    if let start = currentStart {
                                        let element = DrawingElement(
                                            tool: selectedTool,
                                            start: start,
                                            end: value.location,
                                            color: selectedColor,
                                            lineWidth: lineWidth,
                                            zoomLevel: zoomLevel
                                        )
                                        drawings.append(element)
                                    }
                                    currentStart = nil
                                    currentEnd = nil
                                }
                        )
                }
                .frame(width: max(image.size.width, 600), height: max(image.size.height, 300))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .clipped()

            // Toolbar — always visible at the bottom
            toolbar
        }
    }

    // This view is used for BOTH the UI and the ImageRenderer
    // It is always oriented at (0,0) points to ensure 1:1 pixel mapping
    private var drawingContent: some View {
        ZStack(alignment: .topLeading) {
            Image(nsImage: image)
                .resizable()
                .frame(width: image.size.width, height: image.size.height)
            
            // Completed drawings
            ForEach(Array(drawings.enumerated()), id: \.element.id) { index, drawing in
                if drawing.tool == .arrow {
                    ArrowView(start: drawing.start, end: drawing.end, color: drawing.color, lineWidth: drawing.lineWidth)
                } else if drawing.tool == .stepArrow {
                    let stepNum = drawings[0...index].filter { $0.tool == .stepArrow }.count
                    StepArrowView(start: drawing.start, end: drawing.end, color: drawing.color, lineWidth: drawing.lineWidth, stepNumber: stepNum)
                } else if drawing.tool == .stepRectangle {
                    let stepNum = drawings[0...index].filter { $0.tool == .stepRectangle }.count
                    StepRectangleView(start: drawing.start, end: drawing.end, color: drawing.color, lineWidth: drawing.lineWidth, stepNumber: stepNum)
                } else if drawing.tool == .line {
                    LineView(start: drawing.start, end: drawing.end, color: drawing.color, lineWidth: drawing.lineWidth)
                } else if drawing.tool == .questionArrow {
                    QuestionArrowView(start: drawing.start, end: drawing.end, color: drawing.color, lineWidth: drawing.lineWidth)
                } else if drawing.tool == .questionRectangle {
                    QuestionRectangleView(start: drawing.start, end: drawing.end, color: drawing.color, lineWidth: drawing.lineWidth)
                } else if drawing.tool == .abcArrow {
                    let stepNum = drawings[0...index].filter { $0.tool == .abcArrow }.count
                    ABCArrowView(start: drawing.start, end: drawing.end, color: drawing.color, lineWidth: drawing.lineWidth, stepNumber: stepNum)
                } else if drawing.tool == .abcRectangle {
                    let stepNum = drawings[0...index].filter { $0.tool == .abcRectangle }.count
                    ABCRectangleView(start: drawing.start, end: drawing.end, color: drawing.color, lineWidth: drawing.lineWidth, stepNumber: stepNum)
                } else if drawing.tool == .circle {
                    EllipseView(start: drawing.start, end: drawing.end, color: drawing.color, lineWidth: drawing.lineWidth)
                } else if drawing.tool == .magnifier {
                    MagnifierView(image: image, start: drawing.start, end: drawing.end, color: drawing.color, lineWidth: drawing.lineWidth, zoomLevel: drawing.zoomLevel)
                } else {
                    RectangleShape(start: drawing.start, end: drawing.end)
                        .stroke(drawing.color, lineWidth: drawing.lineWidth)
                }
            }
            
            // Active drawing
            if let start = currentStart, let end = currentEnd {
                if selectedTool == .arrow {
                    ArrowView(start: start, end: end, color: selectedColor, lineWidth: lineWidth)
                } else if selectedTool == .stepArrow {
                    let stepNum = drawings.filter { $0.tool == .stepArrow }.count + 1
                    StepArrowView(start: start, end: end, color: selectedColor, lineWidth: lineWidth, stepNumber: stepNum)
                } else if selectedTool == .stepRectangle {
                    let stepNum = drawings.filter { $0.tool == .stepRectangle }.count + 1
                    StepRectangleView(start: start, end: end, color: selectedColor, lineWidth: lineWidth, stepNumber: stepNum)
                } else if selectedTool == .line {
                    LineView(start: start, end: end, color: selectedColor, lineWidth: lineWidth)
                } else if selectedTool == .questionArrow {
                    QuestionArrowView(start: start, end: end, color: selectedColor, lineWidth: lineWidth)
                } else if selectedTool == .questionRectangle {
                    QuestionRectangleView(start: start, end: end, color: selectedColor, lineWidth: lineWidth)
                } else if selectedTool == .abcArrow {
                    let stepNum = drawings.filter { $0.tool == .abcArrow }.count + 1
                    ABCArrowView(start: start, end: end, color: selectedColor, lineWidth: lineWidth, stepNumber: stepNum)
                } else if selectedTool == .abcRectangle {
                    let stepNum = drawings.filter { $0.tool == .abcRectangle }.count + 1
                    ABCRectangleView(start: start, end: end, color: selectedColor, lineWidth: lineWidth, stepNumber: stepNum)
                } else if selectedTool == .circle {
                    EllipseView(start: start, end: end, color: selectedColor, lineWidth: lineWidth)
                } else if selectedTool == .magnifier {
                    MagnifierView(image: image, start: start, end: end, color: selectedColor, lineWidth: lineWidth, zoomLevel: zoomLevel)
                } else {
                    RectangleShape(start: start, end: end)
                        .stroke(selectedColor, lineWidth: lineWidth)
                }
            }
        }
        .frame(width: image.size.width, height: image.size.height)
        .clipped()
    }
    
    var toolbar: some View {
        HStack(spacing: 8) {
            // Tool Selection — counting tools first, then plain tools, then special tools
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 0) {
                    // Tool 1: Step Arrow
                    Button(action: { selectedTool = .stepArrow }) {
                        Image(systemName: "list.number")
                            .padding(8)
                            .background(selectedTool == .stepArrow ? Color.blue : Color.clear)
                            .foregroundColor(selectedTool == .stepArrow ? .white : .primary)
                    }
                    .buttonStyle(.plain)
                    .help("Step Arrow (1)")
                    
                    Divider().frame(height: 20)
                    
                    // Tool 2: Step Rectangle
                    Button(action: { selectedTool = .stepRectangle }) {
                        Image(systemName: "number.square")
                            .padding(8)
                            .background(selectedTool == .stepRectangle ? Color.blue : Color.clear)
                            .foregroundColor(selectedTool == .stepRectangle ? .white : .primary)
                    }
                    .buttonStyle(.plain)
                    .help("Step Rectangle (2)")
                    
                    Divider().frame(height: 20)
                    
                    // Tool 3: Arrow
                    Button(action: { selectedTool = .arrow }) {
                        Image(systemName: "arrow.up.right")
                            .padding(8)
                            .background(selectedTool == .arrow ? Color.blue : Color.clear)
                            .foregroundColor(selectedTool == .arrow ? .white : .primary)
                    }
                    .buttonStyle(.plain)
                    .help("Arrow (3)")
                    
                    Divider().frame(height: 20)
                    
                    // Tool 4: Rectangle
                    Button(action: { selectedTool = .rectangle }) {
                        Image(systemName: "square")
                            .padding(8)
                            .background(selectedTool == .rectangle ? Color.blue : Color.clear)
                            .foregroundColor(selectedTool == .rectangle ? .white : .primary)
                    }
                    .buttonStyle(.plain)
                    .help("Rectangle (4)")
                    
                    Divider().frame(height: 20)
                    
                    // Tool 5: Circle/Ellipse (moved here from end)
                    Button(action: { selectedTool = .circle }) {
                        Image(systemName: "circle")
                            .padding(8)
                            .background(selectedTool == .circle ? Color.blue : Color.clear)
                            .foregroundColor(selectedTool == .circle ? .white : .primary)
                    }
                    .buttonStyle(.plain)
                    .help("Circle (5)")
                    
                    Divider().frame(height: 20)
                    
                    // Tool 6: Line
                    Button(action: { selectedTool = .line }) {
                        Image(systemName: "line.diagonal")
                            .padding(8)
                            .background(selectedTool == .line ? Color.blue : Color.clear)
                            .foregroundColor(selectedTool == .line ? .white : .primary)
                    }
                    .buttonStyle(.plain)
                    .help("Line (6)")
                    
                    Divider().frame(height: 20)
                    
                    // Tool 7: Question Arrow
                    Button(action: { selectedTool = .questionArrow }) {
                        Image(systemName: "questionmark.circle")
                            .padding(8)
                            .background(selectedTool == .questionArrow ? Color.blue : Color.clear)
                            .foregroundColor(selectedTool == .questionArrow ? .white : .primary)
                    }
                    .buttonStyle(.plain)
                    .help("Question Arrow (7)")
                    
                    Divider().frame(height: 20)
                    
                    // Tool 8: Question Rectangle
                    Button(action: { selectedTool = .questionRectangle }) {
                        Image(systemName: "questionmark.square")
                            .padding(8)
                            .background(selectedTool == .questionRectangle ? Color.blue : Color.clear)
                            .foregroundColor(selectedTool == .questionRectangle ? .white : .primary)
                    }
                    .buttonStyle(.plain)
                    .help("Question Rectangle (8)")
                    
                    Divider().frame(height: 20)
                    
                    // Tool 9: ABC Arrow
                    Button(action: { selectedTool = .abcArrow }) {
                        Image(systemName: "textformat.abc")
                            .padding(8)
                            .background(selectedTool == .abcArrow ? Color.blue : Color.clear)
                            .foregroundColor(selectedTool == .abcArrow ? .white : .primary)
                    }
                    .buttonStyle(.plain)
                    .help("ABC Arrow (9)")
                    
                    Divider().frame(height: 20)
                    
                    // Tool 10: ABC Rectangle
                    Button(action: { selectedTool = .abcRectangle }) {
                        Image(systemName: "character.textbox")
                            .padding(8)
                            .background(selectedTool == .abcRectangle ? Color.blue : Color.clear)
                            .foregroundColor(selectedTool == .abcRectangle ? .white : .primary)
                    }
                    .buttonStyle(.plain)
                    .help("ABC Rectangle (0)")
                    
                    Divider().frame(height: 20)
                    
                    // Tool 11: Magnifier
                    Button(action: { selectedTool = .magnifier }) {
                        Image(systemName: "magnifyingglass")
                            .padding(8)
                            .background(selectedTool == .magnifier ? Color.blue : Color.clear)
                            .foregroundColor(selectedTool == .magnifier ? .white : .primary)
                    }
                    .buttonStyle(.plain)
                    .help("Magnifier (M)")
                }
                .background(Color.gray.opacity(0.1))
                .cornerRadius(8)
                .fixedSize()
            }

            Divider().frame(height: 24)

            // Color Selection
            ColorPicker("", selection: $selectedColor)
                .labelsHidden()
                .fixedSize()

            // Line Width / Zoom Level
            HStack(spacing: 8) {
                if selectedTool == .magnifier {
                    Slider(value: $zoomLevel, in: 1.5...5.0, step: 0.5)
                        .frame(width: 80)
                    Text("\(String(format: "%.1f", zoomLevel))×")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(.secondary)
                        .frame(width: 30)
                } else {
                    Slider(value: $lineWidth, in: 2...15)
                        .frame(width: 80)
                    Text("\(Int(lineWidth))px")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(.secondary)
                        .frame(width: 30)
                }
            }
            .fixedSize()

            Spacer(minLength: 12)

            // Actions
            HStack(spacing: 10) {
                Button("Undo") {
                    if !drawings.isEmpty { drawings.removeLast() }
                }
                .buttonStyle(.plain)
                .disabled(drawings.isEmpty)
                .font(.caption)

                Button("Clear") {
                    drawings.removeAll()
                }
                .buttonStyle(.plain)
                .foregroundColor(.red)
                .font(.caption)

                Button(action: finish) {
                    HStack(spacing: 6) {
                        Image(systemName: "square.and.arrow.down.on.square")
                        Text("Save & Copy")
                            .fontWeight(.bold)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(8)
                }
                .buttonStyle(.plain)
            }
            .fixedSize()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color(NSColor.windowBackgroundColor))
        .frame(minWidth: 550)
    }

    @MainActor
    func finish() {
        let scale = NSScreen.main?.backingScaleFactor ?? 2.0
        
        // Use the EXACT same drawingContent view for the renderer
        // It's already topLeading and correctly framed
        let renderView = drawingContent

        let renderer = ImageRenderer(content: renderView)
        renderer.scale = scale
        
        if let nsImage = renderer.nsImage {
            onComplete(nsImage)
            saveToDownloads(image: nsImage)
        }
    }

    func saveToDownloads(image: NSImage) {
        guard let tiffData = image.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: tiffData),
              let pngData = bitmap.representation(using: .png, properties: [:]) else {
            return
        }
        
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd_HH-mm-ss"
        let filename = "FeatherShot_\(formatter.string(from: Date())).png"
        
        let downloadsUrl = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first!
        let fileUrl = downloadsUrl.appendingPathComponent(filename)
        
        do {
            try pngData.write(to: fileUrl)
        } catch {
            print("Error saving image: \(error)")
        }
    }
}

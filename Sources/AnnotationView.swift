import SwiftUI

struct AnnotationView: View {
    let image: NSImage
    let onComplete: @MainActor @Sendable (NSImage) -> Void

    @State private var drawings: [DrawingElement] = []
    @State private var currentStart: CGPoint?
    @State private var currentEnd: CGPoint?
    
    @State private var selectedTool: Tool = .arrow
    @State private var selectedColor: Color = .red
    @State private var lineWidth: CGFloat = 4.0

    var body: some View {
        VStack(spacing: 0) {
            // Main Interaction Area
            // Center everything so small screenshots are visible and clear
            ZStack(alignment: .center) {
                Color.black.opacity(0.12)
                    .ignoresSafeArea()
                
                // The canvas area is STRICTLY the size of the image
                // Centering here ensures the tiny image is visible
                drawingContent
                    .frame(width: image.size.width, height: image.size.height)
                    .background(Color.white.opacity(0.05)) // Visual hint for image bounds
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
                                    drawings.append(DrawingElement(
                                        tool: selectedTool,
                                        start: start,
                                        end: value.location,
                                        color: selectedColor,
                                        lineWidth: lineWidth
                                    ))
                                }
                                currentStart = nil
                                currentEnd = nil
                            }
                    )
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .clipped()

            // Toolbar
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
        HStack(spacing: 12) {
            // Tool Selection
            HStack(spacing: 0) {
                Button(action: { selectedTool = .arrow }) {
                    Image(systemName: "arrow.up.right")
                        .padding(8)
                        .background(selectedTool == .arrow ? Color.blue : Color.clear)
                        .foregroundColor(selectedTool == .arrow ? .white : .primary)
                }
                .buttonStyle(.plain)
                
                Divider().frame(height: 20)
                
                Button(action: { selectedTool = .stepArrow }) {
                    Image(systemName: "list.number")
                        .padding(8)
                        .background(selectedTool == .stepArrow ? Color.blue : Color.clear)
                        .foregroundColor(selectedTool == .stepArrow ? .white : .primary)
                }
                .buttonStyle(.plain)
                
                Divider().frame(height: 20)
                
                Button(action: { selectedTool = .rectangle }) {
                    Image(systemName: "square")
                        .padding(8)
                        .background(selectedTool == .rectangle ? Color.blue : Color.clear)
                        .foregroundColor(selectedTool == .rectangle ? .white : .primary)
                }
                .buttonStyle(.plain)
            }
            .background(Color.gray.opacity(0.1))
            .cornerRadius(8)
            .fixedSize()

            Divider().frame(height: 24)

            // Color Selection
            ColorPicker("", selection: $selectedColor)
                .labelsHidden()
                .fixedSize()

            // Line Width
            HStack(spacing: 8) {
                Slider(value: $lineWidth, in: 2...15)
                    .frame(width: 80)
                Text("\(Int(lineWidth))px")
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundColor(.secondary)
                    .frame(width: 30)
            }
            .fixedSize()

            Spacer(minLength: 20)

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

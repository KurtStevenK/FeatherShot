import SwiftUI
import AppKit

#if DEBUG
extension Notification.Name {
    /// Debug-only: `FeatherShot --open-editor <png> --press-save` posts this to run Save & Copy.
    static let featherShotPressSaveForTesting = Notification.Name("FeatherShotPressSaveForTesting")
}
#endif

struct AnnotationView: View {
    let image: NSImage
    /// Called after a successful Save & Copy so the owner can close the editor.
    let onComplete: @MainActor @Sendable () -> Void

    @State private var drawings: [DrawingElement] = []
    @State private var currentStart: CGPoint?
    @State private var currentEnd: CGPoint?
    
    @State private var selectedTool: Tool = .stepArrow
    @State private var selectedColor: Color = EditorTheme.swatches[0]
    @State private var lineWidth: CGFloat = 4.0
    @State private var zoomLevel: CGFloat = 2.0
    @State private var isSaved = false
    @State private var editingTextId: UUID?
    @State private var editingTextBuffer: String = ""
    @State private var draggingTextId: UUID?
    @State private var textGestureStart: CGPoint?
    @State private var zoom: EditorZoom = .fit
    /// The canvas area minus its margins, where `.fit` has to fit the screenshot.
    @State private var viewport: CGSize = .zero
    @State private var pinchBaseScale: CGFloat?
    @FocusState private var focus: EditorFocus?

    /// Keyboard focus: the canvas receives the shortcuts, a text field receives typing.
    /// Each text annotation is its own value, so focusing the next one is never a no-op.
    private enum EditorFocus: Hashable { case canvas, text(UUID) }

    var body: some View {
        VStack(spacing: 0) {
            toolBar
            canvasArea
            actionBar
        }
        .background(EditorTheme.background)
        .environment(\.colorScheme, .dark)
        .onKeyPress(phases: [.down, .repeat]) { press in handleKeyPress(press) }
        // Focuses the canvas on appear and the text field while one is open. As a task this runs
        // after the update that adds or removes the field, so focus lands on a view that exists.
        .task(id: openTextId) {
            focus = openTextId.map(EditorFocus.text) ?? .canvas
        }
        #if DEBUG
        .onReceive(NotificationCenter.default.publisher(for: .featherShotPressSaveForTesting)) { _ in
            finish()
        }
        #endif
    }

    // MARK: - Layout

    /// Space around the screenshot inside the canvas area.
    static let canvasMargin: CGFloat = 28
    static let toolBarHeight: CGFloat = 52
    static let actionBarHeight: CGFloat = 56
    /// Narrowest window in which both bars show every control.
    static let minimumWidth: CGFloat = 800

    /// The scale the screenshot is shown at right now.
    private var displayScale: CGFloat {
        zoom.resolved(image: image.size, viewport: viewport)
    }

    /// The screenshot at the current zoom, centered in the window and scrollable when it is bigger.
    private var canvasArea: some View {
        GeometryReader { geo in
            let margin = Self.canvasMargin
            let available = CGSize(width: max(1, geo.size.width - 2 * margin), height: max(1, geo.size.height - 2 * margin))
            let scale = zoom.resolved(image: image.size, viewport: available)
            ScrollView([.horizontal, .vertical]) {
                stage(scale: scale)
                    .padding(margin)
                    .frame(minWidth: geo.size.width, minHeight: geo.size.height)
            }
            .onAppear { viewport = available }
            .onChange(of: available) { _, newValue in viewport = newValue }
        }
        .background(EditorCanvasBackdrop())
        .clipped()
        // Holds keyboard focus so the shortcuts work without clicking first.
        .focusable()
        .focusEffectDisabled()
        .focused($focus, equals: .canvas)
        // Trackpad pinch zooms around the current scale.
        .simultaneousGesture(
            MagnifyGesture()
                .onChanged { value in
                    let base = pinchBaseScale ?? displayScale
                    pinchBaseScale = base
                    zoom = .scale(EditorZoom.clamp(base * value.magnification))
                }
                .onEnded { _ in pinchBaseScale = nil }
        )
    }

    /// The annotated screenshot drawn at `scale`. Drawing happens in image points, so the
    /// gesture converts from the scaled view back to the image.
    private func stage(scale: CGFloat) -> some View {
        drawingContent
            .scaleEffect(scale, anchor: .topLeading)
            .frame(width: image.size.width * scale, height: image.size.height * scale, alignment: .topLeading)
            .overlay(Rectangle().strokeBorder(Color.white.opacity(0.14), lineWidth: 1))
            .shadow(color: .black.opacity(0.55), radius: 24, y: 10)
            .shadow(color: EditorTheme.blue.opacity(0.12), radius: 40)
            .overlay(alignment: .topLeading) { textEditingOverlay(scale: scale) }
            .contentShape(Rectangle())
            .gesture(canvasDragGesture(scale: scale))
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
                } else if drawing.tool == .exclamationArrow {
                    ExclamationArrowView(start: drawing.start, end: drawing.end, color: drawing.color, lineWidth: drawing.lineWidth)
                } else if drawing.tool == .exclamationRectangle {
                    ExclamationRectangleView(start: drawing.start, end: drawing.end, color: drawing.color, lineWidth: drawing.lineWidth)
                } else if drawing.tool == .text {
                    Text(drawing.text)
                        .font(.system(size: drawing.fontSize, weight: .semibold))
                        .foregroundColor(drawing.color)
                        .position(x: drawing.start.x, y: drawing.start.y)
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
                } else if selectedTool == .exclamationArrow {
                    ExclamationArrowView(start: start, end: end, color: selectedColor, lineWidth: lineWidth)
                } else if selectedTool == .exclamationRectangle {
                    ExclamationRectangleView(start: start, end: end, color: selectedColor, lineWidth: lineWidth)
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
    
    // MARK: - Bars

    private struct ToolItem {
        let tool: Tool
        let icon: String
        let name: String
        let key: String
    }

    /// The tool palette, in groups: counters, shapes, markers, then text and magnifier.
    private static let toolGroups: [[ToolItem]] = [
        [
            ToolItem(tool: .stepArrow, icon: "list.number", name: "Step Arrow", key: "1"),
            ToolItem(tool: .stepRectangle, icon: "number.square", name: "Step Rectangle", key: "2"),
            ToolItem(tool: .abcArrow, icon: "textformat.abc", name: "ABC Arrow", key: "9"),
            ToolItem(tool: .abcRectangle, icon: "character.textbox", name: "ABC Rectangle", key: "0"),
        ],
        [
            ToolItem(tool: .arrow, icon: "arrow.up.right", name: "Arrow", key: "3"),
            ToolItem(tool: .rectangle, icon: "square", name: "Rectangle", key: "4"),
            ToolItem(tool: .circle, icon: "circle", name: "Circle", key: "5"),
            ToolItem(tool: .line, icon: "line.diagonal", name: "Line", key: "6"),
        ],
        [
            ToolItem(tool: .questionArrow, icon: "questionmark.circle", name: "Question Arrow", key: "7"),
            ToolItem(tool: .questionRectangle, icon: "questionmark.square", name: "Question Rectangle", key: "8"),
            ToolItem(tool: .exclamationArrow, icon: "exclamationmark.circle", name: "Exclamation Arrow", key: "-"),
            ToolItem(tool: .exclamationRectangle, icon: "exclamationmark.square", name: "Exclamation Rectangle", key: "="),
        ],
        [
            ToolItem(tool: .text, icon: "character.cursor.ibeam", name: "Text", key: "T"),
            ToolItem(tool: .magnifier, icon: "plus.magnifyingglass", name: "Magnifier", key: "M"),
        ],
    ]

    /// Top bar: the tools and the annotation color.
    private var toolBar: some View {
        HStack(spacing: 8) {
            Spacer(minLength: 0)
            ForEach(Self.toolGroups.indices, id: \.self) { index in
                EditorGroup {
                    ForEach(Self.toolGroups[index], id: \.tool) { item in
                        Button { selectTool(item.tool) } label: {
                            Image(systemName: item.icon)
                        }
                        .buttonStyle(EditorIconButtonStyle(isSelected: selectedTool == item.tool))
                        .help("\(item.name) (\(item.key))")
                    }
                }
            }
            colorPicker
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .frame(height: Self.toolBarHeight)
        .background(EditorTheme.bar)
        .overlay(alignment: .bottom) { EditorTheme.border.frame(height: 1) }
        .fixedSize(horizontal: false, vertical: true)
    }

    private var colorPicker: some View {
        EditorGroup {
            HStack(spacing: 5) {
                ForEach(EditorTheme.swatches.indices, id: \.self) { index in
                    let swatch = EditorTheme.swatches[index]
                    let isSelected = swatch == selectedColor
                    Button { selectedColor = swatch } label: {
                        Circle()
                            .fill(swatch)
                            .frame(width: 16, height: 16)
                            .overlay(Circle().strokeBorder(Color.black.opacity(0.25), lineWidth: 1))
                            .padding(3)
                            .overlay(Circle().strokeBorder(isSelected ? Color.white : .clear, lineWidth: 1.5))
                            .contentShape(Circle())
                    }
                    .buttonStyle(.plain)
                }
                // The system color well, hidden under a rainbow swatch that still passes its clicks.
                let isCustom = !EditorTheme.swatches.contains(selectedColor)
                ZStack {
                    ColorPicker("Custom color", selection: $selectedColor, supportsOpacity: false)
                        .labelsHidden()
                        .frame(width: 22, height: 22)
                        .opacity(0.02)
                    Circle()
                        .fill(AngularGradient(colors: [.red, .yellow, .green, .cyan, .blue, .purple, .red], center: .center))
                        .overlay(Circle().fill(isCustom ? selectedColor : .clear).padding(4))
                        .frame(width: 16, height: 16)
                        .padding(3)
                        .overlay(Circle().strokeBorder(isCustom ? Color.white : .clear, lineWidth: 1.5))
                        .allowsHitTesting(false)
                }
                .help("Custom color")
            }
            .padding(.horizontal, 4)
            .frame(height: 30)
        }
    }

    /// Bottom bar: zoom and stroke on the left, the actions on the right.
    private var actionBar: some View {
        HStack(spacing: 10) {
            zoomControl
            strokeControl
            Spacer(minLength: 12)

            Button(action: undo) {
                Label("Undo", systemImage: "arrow.uturn.backward")
            }
            .buttonStyle(EditorPillButtonStyle(kind: .ghost))
            .disabled(drawings.isEmpty)
            .help("Undo (⌘Z)")

            Button { drawings.removeAll() } label: {
                Label("Clear", systemImage: "trash")
            }
            .buttonStyle(EditorPillButtonStyle(kind: .danger))
            .disabled(drawings.isEmpty)
            .help("Remove all annotations")

            Button(action: finish) {
                HStack(spacing: 7) {
                    Image(systemName: isSaved ? "checkmark" : "square.and.arrow.down.on.square")
                    Text(isSaved ? "Saved & Copied" : "Save & Copy")
                    if !isSaved {
                        Text("⌘S")
                            .font(.system(size: 10.5, weight: .semibold, design: .rounded))
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1.5)
                            .background(Capsule().fill(Color.white.opacity(0.18)))
                    }
                }
            }
            .buttonStyle(EditorPillButtonStyle(kind: isSaved ? .success : .primary))
            .help("Save to Downloads and copy to the clipboard (⌘S)")
        }
        .labelStyle(.titleAndIcon)
        .padding(.horizontal, 16)
        .frame(height: Self.actionBarHeight)
        .background(EditorTheme.bar)
        .overlay(alignment: .top) { EditorTheme.border.frame(height: 1) }
        .fixedSize(horizontal: false, vertical: true)
    }

    private var zoomControl: some View {
        let scale = displayScale
        return EditorGroup {
            Button { zoomOut() } label: { Image(systemName: "minus") }
                .buttonStyle(EditorIconButtonStyle(size: 28))
                .disabled(EditorZoom.zoomedOut(from: scale) == nil)
                .help("Zoom Out (⌘-)")

            Menu {
                ForEach(EditorZoom.levels.reversed(), id: \.self) { level in
                    Button(EditorZoom.percent(level)) { zoom = .scale(level) }
                }
            } label: {
                Text(EditorZoom.percent(scale))
                    .font(.system(size: 12, weight: .semibold).monospacedDigit())
                    .foregroundStyle(EditorTheme.text)
                    .frame(width: 46, height: 28)
                    .contentShape(Rectangle())
            }
            .menuStyle(.borderlessButton)
            .menuIndicator(.hidden)
            .fixedSize()
            .help("Zoom level")

            Button { zoomIn() } label: { Image(systemName: "plus") }
                .buttonStyle(EditorIconButtonStyle(size: 28))
                .disabled(EditorZoom.zoomedIn(from: scale) == nil)
                .help("Zoom In (⌘+)")

            EditorTheme.border.frame(width: 1, height: 18).padding(.horizontal, 3)

            Button { zoom = .fit } label: { Text("Fit").font(.system(size: 11.5, weight: .semibold)) }
                .buttonStyle(EditorIconButtonStyle(isSelected: zoom == .fit, size: 34))
                .help("Fit in Window (⌘9)")

            Button { zoom = .scale(1) } label: { Text("1:1").font(.system(size: 11.5, weight: .semibold)) }
                .buttonStyle(EditorIconButtonStyle(isSelected: zoom == .scale(1), size: 34))
                .help("Original Size (⌘0)")
        }
    }

    /// Line width, or the lens zoom while the magnifier is selected.
    private var strokeControl: some View {
        EditorGroup {
            HStack(spacing: 8) {
                Image(systemName: selectedTool == .magnifier ? "plus.magnifyingglass" : "lineweight")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(EditorTheme.muted)
                if selectedTool == .magnifier {
                    Slider(value: $zoomLevel, in: 1.5...5.0, step: 0.5)
                        .frame(width: 84)
                    Text("\(String(format: "%.1f", zoomLevel))×")
                        .frame(width: 34, alignment: .trailing)
                } else {
                    Slider(value: $lineWidth, in: 2...15)
                        .frame(width: 84)
                    Text("\(Int(lineWidth)) px")
                        .frame(width: 34, alignment: .trailing)
                }
            }
            .font(.system(size: 11, weight: .medium).monospacedDigit())
            .foregroundStyle(EditorTheme.muted)
            .controlSize(.small)
            .tint(EditorTheme.blue)
            .padding(.horizontal, 8)
            .frame(height: 28)
            .help(selectedTool == .magnifier ? "Magnifier zoom" : "Line width")
        }
    }

    private func selectTool(_ tool: Tool) {
        // Mid-drag, the gesture would end under the new tool and leave its preview behind.
        if currentStart == nil && textGestureStart == nil {
            selectedTool = tool
        }
    }

    private func zoomIn() {
        if let next = EditorZoom.zoomedIn(from: displayScale) { zoom = .scale(next) }
    }

    private func zoomOut() {
        if let next = EditorZoom.zoomedOut(from: displayScale) { zoom = .scale(next) }
    }

    @ViewBuilder
    private func textEditingOverlay(scale: CGFloat) -> some View {
        if let id = editingTextId,
           let idx = drawings.firstIndex(where: { $0.id == id }) {
            TextField("Text", text: $editingTextBuffer)
                .textFieldStyle(.roundedBorder)
                .frame(width: min(280, max(140, image.size.width * scale * 0.4)))
                .position(x: drawings[idx].start.x * scale, y: drawings[idx].start.y * scale)
                .focused($focus, equals: .text(id))
                .onSubmit { commitTextEdit() }
                // Tab and ⇧Tab (U+0019) end the edit like Return, instead of moving focus to the
                // canvas and leaving the field open.
                .onKeyPress(keys: [.tab, KeyEquivalent("\u{19}")]) { _ in
                    commitTextEdit()
                    return .handled
                }
                .onChange(of: editingTextBuffer) { _, newValue in
                    if let i = drawings.firstIndex(where: { $0.id == id }) {
                        drawings[i].text = newValue
                    }
                }
        }
    }

    /// The text annotation whose field is on screen (the condition of `textEditingOverlay`).
    private var openTextId: UUID? {
        editingTextId.flatMap { id in drawings.contains { $0.id == id } ? id : nil }
    }

    private var isEditingText: Bool { openTextId != nil }

    /// Drawing in image points: the view shows the image at `scale`.
    private func canvasDragGesture(scale: CGFloat) -> some Gesture {
        let toImage = { (point: CGPoint) in CGPoint(x: point.x / scale, y: point.y / scale) }
        return DragGesture(minimumDistance: 0)
            .onChanged { value in
                let startLocation = toImage(value.startLocation)
                let location = toImage(value.location)
                // Clicking the canvas ends text editing, as in the Electron editor; otherwise
                // the open text field would keep blocking the shortcuts.
                if isEditingText && currentStart == nil && textGestureStart == nil {
                    commitTextEdit()
                }
                if selectedTool == .text {
                    if draggingTextId == nil, textGestureStart == nil {
                        textGestureStart = startLocation
                        if let hit = textHit(at: startLocation) {
                            draggingTextId = hit
                        }
                    }
                    if let id = draggingTextId,
                       let idx = drawings.firstIndex(where: { $0.id == id }) {
                        drawings[idx].start = location
                    }
                    return
                }
                if currentStart == nil {
                    currentStart = startLocation
                }
                currentEnd = location
            }
            .onEnded { value in
                let startLocation = toImage(value.startLocation)
                let location = toImage(value.location)
                if selectedTool == .text {
                    defer {
                        draggingTextId = nil
                        textGestureStart = nil
                    }
                    let dist = hypot(value.translation.width, value.translation.height)
                    if dist > 6 {
                        return
                    }
                    if let hit = textHit(at: startLocation) {
                        editingTextId = hit
                        editingTextBuffer = drawings.first(where: { $0.id == hit })?.text ?? ""
                        return
                    }
                    let element = DrawingElement(
                        tool: .text,
                        start: location,
                        end: location,
                        color: selectedColor,
                        lineWidth: lineWidth,
                        text: "Text",
                        fontSize: max(18, lineWidth * 5)
                    )
                    drawings.append(element)
                    editingTextId = element.id
                    editingTextBuffer = "Text"
                    return
                }
                if let start = currentStart {
                    let element = DrawingElement(
                        tool: selectedTool,
                        start: start,
                        end: location,
                        color: selectedColor,
                        lineWidth: lineWidth,
                        zoomLevel: zoomLevel
                    )
                    drawings.append(element)
                }
                currentStart = nil
                currentEnd = nil
            }
    }

    private func textHit(at point: CGPoint) -> UUID? {
        for drawing in drawings.reversed() where drawing.tool == .text {
            let w = CGFloat(max(80, Double(drawing.text.count) * Double(drawing.fontSize) * 0.55))
            let h = drawing.fontSize * 1.4
            let rect = CGRect(
                x: drawing.start.x - w / 2,
                y: drawing.start.y - h / 2,
                width: w,
                height: h
            )
            if rect.contains(point) {
                return drawing.id
            }
        }
        return nil
    }

    private func commitTextEdit() {
        guard let id = editingTextId,
              let idx = drawings.firstIndex(where: { $0.id == id }) else {
            editingTextId = nil
            return
        }
        let trimmed = editingTextBuffer.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            drawings.remove(at: idx)
        } else {
            drawings[idx].text = trimmed
        }
        editingTextId = nil
        editingTextBuffer = ""
    }

    private func handleKeyPress(_ press: KeyPress) -> KeyPress.Result {
        guard let shortcut = EditorShortcut.match(
            press.characters, modifiers: press.modifiers, isEditingText: isEditingText
        ) else {
            return .ignored
        }
        switch shortcut {
        case .select(let tool):
            selectTool(tool)
        case .zoomIn:
            zoomIn()
        case .zoomOut:
            zoomOut()
        case .actualSize:
            zoom = .scale(1)
        case .zoomToFit:
            zoom = .fit
        case .undo:
            undo()
        case .saveAndCopy:
            // Once per press: holding ⌘S must not save again behind an error alert.
            if press.phase == .down {
                finish()
            }
        }
        return .handled
    }

    private func undo() {
        if !drawings.isEmpty { drawings.removeLast() }
    }

    @MainActor
    func finish() {
        commitTextEdit()

        guard let bitmap = renderBitmap() else {
            showAlert("Save & Copy failed", "Could not render the annotated screenshot.")
            return
        }

        let outcome = ScreenshotExport.perform(bitmap)
        if outcome.saveError == nil && outcome.copied {
            isSaved = true
            onComplete()
            return
        }

        // Keep the editor open on any failure so the annotations are not lost.
        if let saveError = outcome.saveError {
            let copyNote = outcome.copied
                ? "The screenshot was copied to the clipboard."
                : "It could not be copied to the clipboard either."
            offerSaveAs(bitmap, reason: "\(saveError.localizedDescription)\n\n\(copyNote)")
        } else if let savedURL = outcome.savedURL {
            showAlert(
                "Could not copy to the clipboard",
                "The screenshot was saved as \(savedURL.lastPathComponent) in Downloads."
            )
        }
    }

    /// Renders the annotated image at the capture's own pixel density (1:1 with the screenshot).
    @MainActor
    func renderBitmap() -> NSBitmapImageRep? {
        let renderer = ImageRenderer(content: drawingContent)
        renderer.scale = ScreenshotExport.pixelScale(of: image) ?? NSScreen.main?.backingScaleFactor ?? 2.0
        // Not opaque: window captures (Space during selection) keep their transparent shadow.
        guard let cgImage = renderer.cgImage else { return nil }
        return NSBitmapImageRep(cgImage: cgImage)
    }

    @MainActor
    private func offerSaveAs(_ bitmap: NSBitmapImageRep, reason: String) {
        let alert = NSAlert()
        alert.messageText = "Could not save to Downloads"
        alert.informativeText = reason
        alert.alertStyle = .warning
        alert.addButton(withTitle: "Save As…")
        alert.addButton(withTitle: "Cancel")
        guard alert.runModal() == .alertFirstButtonReturn else { return }

        let panel = NSSavePanel()
        panel.allowedContentTypes = [.png]
        panel.nameFieldStringValue = "FeatherShot_\(ScreenshotExport.timestamp(Date())).png"
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do {
            guard let png = bitmap.representation(using: .png, properties: [:]) else {
                throw CocoaError(.fileWriteUnknown)
            }
            try png.write(to: url, options: .atomic)
            isSaved = true
            onComplete()
        } catch {
            showAlert("Save failed", error.localizedDescription)
        }
    }

    private func showAlert(_ title: String, _ message: String) {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.alertStyle = .warning
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }
}

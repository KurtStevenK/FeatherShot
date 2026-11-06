import SwiftUI

/// Step 2: annotate the cropped screenshot with the Mac tools, then Save & Copy.
struct EditorView: View {
    let image: UIImage
    let model: AppModel

    @State private var drawings: [DrawingElement] = []
    @State private var active: DrawingElement?
    @State private var selectedTool: Tool = .stepArrow
    @State private var selectedColor: Color = EditorTheme.swatches[0]
    @State private var lineWidth: CGFloat = 4
    @State private var zoomLevel: CGFloat = 2
    @State private var movingTextId: UUID?
    @State private var textEdit: TextEdit?
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var errorOffersSettings = false

    init(image: UIImage, model: AppModel, initialDrawings: [DrawingElement] = [], initialTool: Tool = .stepArrow) {
        self.image = image
        self.model = model
        _drawings = State(initialValue: initialDrawings)
        _selectedTool = State(initialValue: initialTool)
    }

    /// The text alert: a new annotation at `location`, or the existing one `id`.
    private struct TextEdit {
        var id: UUID?
        var location: CGPoint
        var text: String
    }

    var body: some View {
        VStack(spacing: 0) {
            topBar
            toolBar
            EditorCanvas(
                contentSize: image.size,
                content: AnyView(AnnotationLayer(image: image, drawings: drawings, active: active)),
                onTap: handleTap,
                onDrag: handleDrag
            )
            .background(EditorCanvasBackdrop())
            .clipped()
            .accessibilityLabel("Screenshot canvas")
            bottomBar
        }
        .alert(textEdit?.id == nil ? "Add Text" : "Edit Text", isPresented: textAlertShown) {
            TextField("Text", text: textBinding)
            Button("Cancel", role: .cancel) { textEdit = nil }
            Button("Done") { commitText() }
        }
    }

    // MARK: - Bars

    private var topBar: some View {
        HStack(spacing: 8) {
            Button { model.recrop() } label: {
                Label("Area", systemImage: "crop")
            }
            .buttonStyle(EditorPillButtonStyle(kind: .ghost))
            .accessibilityLabel("Change area")

            Spacer(minLength: 4)

            Button(action: undo) { Image(systemName: "arrow.uturn.backward") }
                .buttonStyle(EditorIconButtonStyle(size: 36))
                .disabled(drawings.isEmpty)
                .accessibilityLabel("Undo")

            Button { drawings.removeAll() } label: { Image(systemName: "trash") }
                .buttonStyle(EditorIconButtonStyle(size: 36))
                .disabled(drawings.isEmpty)
                .accessibilityLabel("Remove all annotations")

            Button {
                Task { await saveAndCopy() }
            } label: {
                HStack(spacing: 6) {
                    if isSaving {
                        ProgressView().controlSize(.small).tint(.white)
                    } else {
                        Image(systemName: "square.and.arrow.down.on.square")
                    }
                    Text("Save & Copy")
                }
            }
            .buttonStyle(EditorPillButtonStyle(kind: .primary))
            .disabled(isSaving)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(EditorTheme.bar)
    }

    private struct ToolItem {
        let tool: Tool
        let icon: String
        let name: String
    }

    /// Same palette and order as the Mac editor: counters, shapes, markers, text and magnifier.
    private static let toolGroups: [[ToolItem]] = [
        [
            ToolItem(tool: .stepArrow, icon: "list.number", name: "Step Arrow"),
            ToolItem(tool: .stepRectangle, icon: "number.square", name: "Step Rectangle"),
            ToolItem(tool: .abcArrow, icon: "textformat.abc", name: "ABC Arrow"),
            ToolItem(tool: .abcRectangle, icon: "character.textbox", name: "ABC Rectangle"),
        ],
        [
            ToolItem(tool: .arrow, icon: "arrow.up.right", name: "Arrow"),
            ToolItem(tool: .rectangle, icon: "square", name: "Rectangle"),
            ToolItem(tool: .circle, icon: "circle", name: "Circle"),
            ToolItem(tool: .line, icon: "line.diagonal", name: "Line"),
        ],
        [
            ToolItem(tool: .questionArrow, icon: "questionmark.circle", name: "Question Arrow"),
            ToolItem(tool: .questionRectangle, icon: "questionmark.square", name: "Question Rectangle"),
            ToolItem(tool: .exclamationArrow, icon: "exclamationmark.circle", name: "Exclamation Arrow"),
            ToolItem(tool: .exclamationRectangle, icon: "exclamationmark.square", name: "Exclamation Rectangle"),
        ],
        [
            ToolItem(tool: .text, icon: "character.cursor.ibeam", name: "Text"),
            ToolItem(tool: .magnifier, icon: "plus.magnifyingglass", name: "Magnifier"),
        ],
    ]

    private var toolBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Self.toolGroups.indices, id: \.self) { index in
                    EditorGroup {
                        ForEach(Self.toolGroups[index], id: \.tool) { item in
                            Button { selectTool(item.tool) } label: { Image(systemName: item.icon) }
                                .buttonStyle(EditorIconButtonStyle(isSelected: selectedTool == item.tool, size: 38))
                                .accessibilityLabel(item.name)
                                .accessibilityAddTraits(selectedTool == item.tool ? .isSelected : [])
                        }
                    }
                }
                colorPicker
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
        }
        .background(EditorTheme.bar)
        .overlay(alignment: .bottom) { EditorTheme.border.frame(height: 1) }
    }

    private var colorPicker: some View {
        EditorGroup {
            HStack(spacing: 4) {
                ForEach(EditorTheme.swatches.indices, id: \.self) { index in
                    let swatch = EditorTheme.swatches[index]
                    let isSelected = swatch == selectedColor
                    Button { selectedColor = swatch } label: {
                        Circle()
                            .fill(swatch)
                            .frame(width: 22, height: 22)
                            .overlay(Circle().strokeBorder(Color.black.opacity(0.25), lineWidth: 1))
                            .padding(4)
                            .overlay(Circle().strokeBorder(isSelected ? Color.white : .clear, lineWidth: 2))
                            .contentShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Color \(index + 1)")
                    .accessibilityAddTraits(isSelected ? .isSelected : [])
                }
                ColorPicker("Custom color", selection: $selectedColor, supportsOpacity: false)
                    .labelsHidden()
                    .padding(.horizontal, 4)
            }
            .padding(.horizontal, 4)
            .frame(height: 38)
        }
    }

    private var bottomBar: some View {
        VStack(spacing: 6) {
            if let errorMessage {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(EditorTheme.danger)
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(EditorTheme.text)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if errorOffersSettings {
                        Button("Settings") {
                            if let url = URL(string: UIApplication.openSettingsURLString) {
                                UIApplication.shared.open(url)
                            }
                        }
                        .font(.footnote.weight(.semibold))
                    }
                }
            }
            HStack(spacing: 10) {
                Image(systemName: selectedTool == .magnifier ? "plus.magnifyingglass" : "lineweight")
                    .foregroundStyle(EditorTheme.muted)
                if selectedTool == .magnifier {
                    Slider(value: $zoomLevel, in: 1.5...5.0, step: 0.5)
                        .accessibilityLabel("Magnifier zoom")
                    Text("\(String(format: "%.1f", zoomLevel))×")
                        .frame(width: 44, alignment: .trailing)
                } else {
                    Slider(value: $lineWidth, in: 2...15)
                        .accessibilityLabel("Line width")
                    Text("\(Int(lineWidth)) pt")
                        .frame(width: 44, alignment: .trailing)
                }
            }
            .font(.footnote.monospacedDigit())
            .foregroundStyle(EditorTheme.muted)
            .tint(EditorTheme.blue)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(EditorTheme.bar)
        .overlay(alignment: .top) { EditorTheme.border.frame(height: 1) }
    }

    // MARK: - Drawing

    private func selectTool(_ tool: Tool) {
        // Mid-drag the gesture would end under the new tool.
        if active == nil && movingTextId == nil { selectedTool = tool }
    }

    private func handleDrag(_ drag: EditorCanvas.Drag) {
        switch drag {
        case .changed(let start, let location):
            if selectedTool == .text {
                if movingTextId == nil { movingTextId = textHit(at: start) }
                if let id = movingTextId, let i = drawings.firstIndex(where: { $0.id == id }) {
                    drawings[i].start = location
                }
                return
            }
            active = element(from: start, to: location)
        case .ended(let start, let location):
            if selectedTool == .text {
                movingTextId = nil
                return
            }
            drawings.append(element(from: start, to: location))
            active = nil
        case .cancelled:
            active = nil
            movingTextId = nil
        }
    }

    private func element(from start: CGPoint, to end: CGPoint) -> DrawingElement {
        DrawingElement(
            tool: selectedTool, start: start, end: end,
            color: selectedColor, lineWidth: lineWidth, zoomLevel: zoomLevel
        )
    }

    /// With the text tool, a tap edits the text under the finger or adds one.
    private func handleTap(_ location: CGPoint) {
        guard selectedTool == .text else { return }
        if let id = textHit(at: location), let existing = drawings.first(where: { $0.id == id }) {
            textEdit = TextEdit(id: id, location: existing.start, text: existing.text)
        } else {
            textEdit = TextEdit(id: nil, location: location, text: "")
        }
    }

    private func textHit(at point: CGPoint) -> UUID? {
        for drawing in drawings.reversed() where drawing.tool == .text {
            let w = CGFloat(max(80, Double(drawing.text.count) * Double(drawing.fontSize) * 0.55))
            let h = drawing.fontSize * 1.4
            // A finger is less precise than a pointer: a little extra reach.
            let rect = CGRect(x: drawing.start.x - w / 2, y: drawing.start.y - h / 2, width: w, height: h)
                .insetBy(dx: -10, dy: -10)
            if rect.contains(point) { return drawing.id }
        }
        return nil
    }

    private var textAlertShown: Binding<Bool> {
        Binding(get: { textEdit != nil }, set: { if !$0 { textEdit = nil } })
    }

    private var textBinding: Binding<String> {
        Binding(get: { textEdit?.text ?? "" }, set: { textEdit?.text = $0 })
    }

    private func commitText() {
        guard let edit = textEdit else { return }
        textEdit = nil
        let text = edit.text.trimmingCharacters(in: .whitespacesAndNewlines)
        if let id = edit.id, let i = drawings.firstIndex(where: { $0.id == id }) {
            if text.isEmpty { drawings.remove(at: i) } else { drawings[i].text = text }
            return
        }
        guard !text.isEmpty else { return }
        drawings.append(DrawingElement(
            tool: .text, start: edit.location, end: edit.location,
            color: selectedColor, lineWidth: lineWidth,
            text: text, fontSize: max(18, lineWidth * 5)
        ))
    }

    private func undo() {
        if !drawings.isEmpty { drawings.removeLast() }
    }

    // MARK: - Export

    /// The annotated image at the screenshot's own pixel size.
    @MainActor
    func renderPNG() -> Data? {
        let renderer = ImageRenderer(content: AnnotationLayer(image: image, drawings: drawings))
        renderer.scale = image.scale
        guard let rendered = renderer.uiImage else { return nil }
        return PhotoExport.pngData(of: rendered)
    }

    @MainActor
    private func saveAndCopy() async {
        errorMessage = nil
        errorOffersSettings = false
        guard let png = renderPNG() else {
            errorMessage = "Could not render the annotated screenshot."
            return
        }
        isSaving = true
        let outcome = await PhotoExport.perform(png: png)
        isSaving = false
        if outcome.saveError == nil && outcome.copied {
            WatchSync.shared.send(png: png)
            model.finish()
            return
        }
        // Keep the editor open so the annotations are not lost.
        if let saveError = outcome.saveError {
            errorMessage = saveError.message + (outcome.copied ? " The image was copied to the clipboard." : "")
            errorOffersSettings = saveError == .notAllowed
        }
    }
}

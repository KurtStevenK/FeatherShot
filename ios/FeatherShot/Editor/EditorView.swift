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
    /// From the finger to the grabbed text's center, so a dragged text does not jump.
    @State private var textGrabOffset: CGSize = .zero
    /// The text annotation being typed on the canvas. Its field shows the text.
    @State private var editingTextId: UUID?
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var errorOffersSettings = false

    init(image: UIImage, model: AppModel, initialDrawings: [DrawingElement] = [], initialTool: Tool = .stepArrow) {
        self.image = image
        self.model = model
        _drawings = State(initialValue: initialDrawings)
        _selectedTool = State(initialValue: initialTool)
    }

    var body: some View {
        VStack(spacing: 0) {
            topBar
            toolBar
            EditorCanvas(
                contentSize: image.size,
                content: AnyView(AnnotationLayer(image: image, drawings: drawings, active: active, textEditing: textEditing)),
                onTap: handleTap,
                onDrag: handleDrag
            )
            .background(EditorCanvasBackdrop())
            .clipped()
            .accessibilityLabel("Screenshot canvas")
            bottomBar
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

            Button {
                editingTextId = nil
                drawings.removeAll()
            } label: { Image(systemName: "trash") }
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
            ToolItem(tool: .dashedLine, icon: "ellipsis", name: "Dashed Line"),
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
        // Keep the tools out of the iPhone Duo's status bar column; the bar's color still reaches the edge.
        .clipped()
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
        guard active == nil && movingTextId == nil else { return }
        // Another tool ends the text being typed; the field must not stay open behind it.
        finishTextEdit()
        selectedTool = tool
    }

    private func handleDrag(_ drag: EditorCanvas.Drag) {
        switch drag {
        case .changed(let start, let location):
            if selectedTool == .text {
                if movingTextId == nil { grabText(at: start) }
                if let id = movingTextId, let i = drawings.firstIndex(where: { $0.id == id }) {
                    drawings[i].start = CGPoint(x: location.x + textGrabOffset.width, y: location.y + textGrabOffset.height)
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

    // MARK: - Text

    /// With the text tool, a tap edits the text under the finger or starts a new one right there.
    /// A tap anywhere else first ends the text being typed (kept, or dropped if it is empty).
    private func handleTap(_ location: CGPoint) {
        guard selectedTool == .text else { return }
        let hit = TextAnnotation.hit(in: drawings, at: location, slop: Self.fingerSlop, editing: editingTextId)
        if let hit, hit == editingTextId { return }
        finishTextEdit()
        if let hit, drawings.contains(where: { $0.id == hit }) {
            editingTextId = hit
            return
        }
        let text = DrawingElement(
            tool: .text, start: location, end: location,
            color: selectedColor, lineWidth: lineWidth,
            text: "", fontSize: TextAnnotation.fontSize(lineWidth: lineWidth)
        )
        drawings.append(text)
        editingTextId = text.id
    }

    /// The start of a text tool drag: a drag that does not start on the open text ends it, and a
    /// drag on a text moves it, keeping where the finger grabbed it.
    private func grabText(at point: CGPoint) {
        let hit = TextAnnotation.hit(in: drawings, at: point, slop: Self.fingerSlop, editing: editingTextId)
        if hit != editingTextId { finishTextEdit() }
        guard let hit, let text = drawings.first(where: { $0.id == hit }) else { return }
        movingTextId = hit
        textGrabOffset = CGSize(width: text.start.x - point.x, height: text.start.y - point.y)
    }

    /// A finger is less precise than a pointer: a little extra reach around texts.
    private static let fingerSlop: CGFloat = 10

    /// The open text for the canvas, which shows it as an input field.
    private var textEditing: AnnotationLayer.TextEditing? {
        guard let id = editingTextId, drawings.contains(where: { $0.id == id }) else { return nil }
        return AnnotationLayer.TextEditing(
            id: id,
            text: Binding(
                get: { drawings.first(where: { $0.id == id })?.text ?? "" },
                set: { newValue in
                    guard let i = drawings.firstIndex(where: { $0.id == id }) else { return }
                    drawings[i].text = newValue
                }
            ),
            onDone: { finishTextEdit() }
        )
    }

    /// Ends text editing: the text stays (trimmed), or goes away if nothing was typed.
    /// Return, a tap elsewhere, another tool, Undo and Save & Copy all go through here, so a
    /// typed text is never lost in an open field.
    private func finishTextEdit() {
        guard let id = editingTextId else { return }
        editingTextId = nil
        TextAnnotation.commit(id, in: &drawings)
    }

    private func undo() {
        if let id = editingTextId {
            editingTextId = nil
            // A text that was started but not typed into is what Undo takes back.
            if TextAnnotation.commit(id, in: &drawings) == .removed { return }
        }
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
        finishTextEdit()
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

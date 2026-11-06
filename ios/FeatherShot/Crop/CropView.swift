import SwiftUI

/// Step 1: the whole screenshot; drag a rectangle over the part to keep.
/// Drag on the image to draw a new area, inside the area to move it, a corner to resize it.
struct CropView: View {
    let sourceURL: URL
    let model: AppModel

    @Environment(\.displayScale) private var displayScale
    @State private var image: UIImage?
    @State private var loadFailed = false
    /// The area to keep, in image points.
    @State private var cropRect: CGRect = .zero
    @State private var drag: DragMode?

    private enum DragMode {
        case draw(from: CGPoint)
        case move(original: CGRect)
        case resize(CropMath.Corner)
    }

    /// Smallest area, in image points, so the handles never collapse onto each other.
    private static let minSize: CGFloat = 24
    /// How close (screen points) a touch must land to a corner to grab it.
    private static let handleReach: CGFloat = 32

    var body: some View {
        VStack(spacing: 0) {
            topBar
            ZStack {
                EditorCanvasBackdrop()
                if let image {
                    GeometryReader { geo in
                        let frame = CropMath.fitFrame(image: image.size, in: geo.size)
                        cropStage(image: image, frame: frame)
                    }
                    .padding(20)
                } else if loadFailed {
                    ContentUnavailableView(
                        "Could not open the screenshot", systemImage: "photo.badge.exclamationmark",
                        description: Text("The file is not an image FeatherShot can read.")
                    )
                } else {
                    ProgressView()
                }
            }
            hintBar
        }
        .task {
            guard image == nil else { return }
            if let loaded = ScreenshotImage.load(sourceURL, scale: displayScale) {
                image = loaded
                cropRect = CGRect(origin: .zero, size: loaded.size)
                #if DEBUG
                if let px = DemoScenes.cropPixelRect {
                    let k = 1 / loaded.scale
                    cropRect = CGRect(x: px.minX * k, y: px.minY * k, width: px.width * k, height: px.height * k)
                }
                #endif
            } else {
                loadFailed = true
            }
        }
    }

    // MARK: - Bars

    private var topBar: some View {
        HStack {
            Button("Cancel", role: .cancel) { model.cancel() }
                .buttonStyle(EditorPillButtonStyle(kind: .ghost))
            Spacer()
            Text("Select Area")
                .font(.headline)
                .foregroundStyle(EditorTheme.text)
            Spacer()
            Button {
                confirm()
            } label: {
                Label("Next", systemImage: "chevron.right")
                    .labelStyle(.titleOnly)
            }
            .buttonStyle(EditorPillButtonStyle(kind: .primary))
            .disabled(image == nil)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(EditorTheme.bar)
        .overlay(alignment: .bottom) { EditorTheme.border.frame(height: 1) }
    }

    private var hintBar: some View {
        HStack(spacing: 12) {
            Text("Drag to select the area to keep.")
                .font(.footnote)
                .foregroundStyle(EditorTheme.muted)
            Spacer()
            Button("Whole Screenshot") {
                if let image { cropRect = CGRect(origin: .zero, size: image.size) }
            }
            .buttonStyle(EditorPillButtonStyle(kind: .ghost))
            .disabled(image.map { cropRect == CGRect(origin: .zero, size: $0.size) } ?? true)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(EditorTheme.bar)
        .overlay(alignment: .top) { EditorTheme.border.frame(height: 1) }
    }

    // MARK: - Stage

    private func cropStage(image: UIImage, frame: CGRect) -> some View {
        let selection = CropMath.viewRect(cropRect, frame: frame, imageSize: image.size)
        return ZStack(alignment: .topLeading) {
            Image(uiImage: image)
                .resizable()
                .frame(width: frame.width, height: frame.height)
                .offset(x: frame.minX, y: frame.minY)

            // Dim everything outside the selection.
            Path { path in
                path.addRect(frame)
                path.addRect(selection)
            }
            .fill(Color.black.opacity(0.55), style: FillStyle(eoFill: true))

            Rectangle()
                .strokeBorder(Color.white, lineWidth: 1.5)
                .frame(width: selection.width, height: selection.height)
                .offset(x: selection.minX, y: selection.minY)

            ForEach(CropMath.Corner.allCases, id: \.self) { corner in
                let p = CropMath.point(of: corner, in: selection)
                Circle()
                    .fill(Color.white)
                    .overlay(Circle().strokeBorder(EditorTheme.blue, lineWidth: 2))
                    .frame(width: 18, height: 18)
                    .position(p)
                    .shadow(color: .black.opacity(0.4), radius: 3)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .contentShape(Rectangle())
        .gesture(cropGesture(image: image, frame: frame, selection: selection))
        .accessibilityElement()
        .accessibilityLabel("Screenshot")
        .accessibilityHint("Drag to select the area to keep")
    }

    private func cropGesture(image: UIImage, frame: CGRect, selection: CGRect) -> some Gesture {
        let bounds = CGRect(origin: .zero, size: image.size)
        let toImage = { (p: CGPoint) in CropMath.imagePoint(p, frame: frame, imageSize: image.size) }
        return DragGesture(minimumDistance: 2)
            .onChanged { value in
                if drag == nil {
                    drag = startMode(at: value.startLocation, selection: selection, frame: frame, imageSize: image.size)
                }
                let location = toImage(value.location)
                switch drag {
                case .draw(let from):
                    cropRect = CropMath.rect(from: from, to: location, in: bounds)
                case .move(let original):
                    let start = toImage(value.startLocation)
                    cropRect = CropMath.moved(
                        original, by: CGSize(width: location.x - start.x, height: location.y - start.y), in: bounds
                    )
                case .resize(let corner):
                    cropRect = CropMath.resized(cropRect, corner: corner, to: location, in: bounds, minSize: Self.minSize)
                case nil:
                    break
                }
            }
            .onEnded { _ in
                // A tiny new area is almost always a mis-tap: keep a usable minimum.
                if cropRect.width < Self.minSize || cropRect.height < Self.minSize {
                    let center = CGPoint(x: cropRect.midX, y: cropRect.midY)
                    let side = min(Self.minSize * 4, bounds.width, bounds.height)
                    cropRect = CropMath.moved(
                        CGRect(x: center.x - side / 2, y: center.y - side / 2, width: side, height: side),
                        by: .zero, in: bounds
                    )
                }
                drag = nil
            }
    }

    private func startMode(at viewPoint: CGPoint, selection: CGRect, frame: CGRect, imageSize: CGSize) -> DragMode {
        let nearest = CropMath.Corner.allCases.min { a, b in
            distance(CropMath.point(of: a, in: selection), viewPoint) < distance(CropMath.point(of: b, in: selection), viewPoint)
        }
        if let nearest, distance(CropMath.point(of: nearest, in: selection), viewPoint) <= Self.handleReach {
            return .resize(nearest)
        }
        let bounds = CGRect(origin: .zero, size: imageSize)
        // While the whole screenshot is selected, a drag anywhere starts a new area.
        if cropRect != bounds && selection.contains(viewPoint) {
            return .move(original: cropRect)
        }
        return .draw(from: CropMath.clamp(CropMath.imagePoint(viewPoint, frame: frame, imageSize: imageSize), to: bounds))
    }

    private func distance(_ a: CGPoint, _ b: CGPoint) -> CGFloat {
        hypot(a.x - b.x, a.y - b.y)
    }

    private func confirm() {
        guard let image, let cropped = ScreenshotImage.crop(image, to: cropRect) else { return }
        model.startEditing(cropped)
    }
}

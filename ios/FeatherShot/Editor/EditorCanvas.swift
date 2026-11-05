import SwiftUI
import UIKit

/// The zoomable canvas. One finger draws (taps and drags arrive in image points); two fingers
/// pan and pinch, like Photos markup. Built on `UIScrollView` because SwiftUI's `ScrollView`
/// cannot leave one-finger drags to the drawing.
struct EditorCanvas: UIViewRepresentable {
    enum Drag {
        case changed(start: CGPoint, location: CGPoint)
        case ended(start: CGPoint, location: CGPoint)
        /// A second finger landed: drop the shape in progress, the user is zooming.
        case cancelled
    }

    let contentSize: CGSize
    let content: AnyView
    var onTap: (CGPoint) -> Void
    var onDrag: (Drag) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    func makeUIView(context: Context) -> FittingScrollView {
        let coordinator = context.coordinator
        let scrollView = FittingScrollView()
        scrollView.delegate = coordinator
        scrollView.backgroundColor = .clear
        scrollView.showsHorizontalScrollIndicator = false
        scrollView.showsVerticalScrollIndicator = false
        scrollView.bouncesZoom = true
        scrollView.contentInsetAdjustmentBehavior = .never
        scrollView.panGestureRecognizer.minimumNumberOfTouches = 2

        let host = coordinator.host
        host.view.backgroundColor = .clear
        host.safeAreaRegions = []
        scrollView.addSubview(host.view)
        scrollView.contentView = host.view
        scrollView.setContent(size: contentSize)

        let pan = UIPanGestureRecognizer(target: coordinator, action: #selector(Coordinator.handlePan(_:)))
        pan.maximumNumberOfTouches = 1
        host.view.addGestureRecognizer(pan)
        coordinator.pan = pan

        let tap = UITapGestureRecognizer(target: coordinator, action: #selector(Coordinator.handleTap(_:)))
        host.view.addGestureRecognizer(tap)
        return scrollView
    }

    func updateUIView(_ scrollView: FittingScrollView, context: Context) {
        context.coordinator.parent = self
        context.coordinator.host.rootView = content
        if scrollView.contentSizeInPoints != contentSize {
            scrollView.setContent(size: contentSize)
        }
    }

    @MainActor
    final class Coordinator: NSObject, UIScrollViewDelegate {
        var parent: EditorCanvas
        let host: UIHostingController<AnyView>
        weak var pan: UIPanGestureRecognizer?
        private var dragStart: CGPoint?

        init(parent: EditorCanvas) {
            self.parent = parent
            self.host = UIHostingController(rootView: parent.content)
        }

        func viewForZooming(in scrollView: UIScrollView) -> UIView? { host.view }

        func scrollViewDidZoom(_ scrollView: UIScrollView) {
            (scrollView as? FittingScrollView)?.centerContent()
        }

        func scrollViewDidEndZooming(_ scrollView: UIScrollView, with view: UIView?, atScale scale: CGFloat) {
            (scrollView as? FittingScrollView)?.sharpenContent()
        }

        func scrollViewWillBeginZooming(_ scrollView: UIScrollView, with view: UIView?) { cancelDrawing() }
        func scrollViewWillBeginDragging(_ scrollView: UIScrollView) { cancelDrawing() }

        private func cancelDrawing() {
            guard dragStart != nil, let pan else { return }
            dragStart = nil
            // Toggling ends the recognizer's current touch sequence.
            pan.isEnabled = false
            pan.isEnabled = true
            parent.onDrag(.cancelled)
        }

        @objc func handlePan(_ recognizer: UIPanGestureRecognizer) {
            let view = host.view
            let location = recognizer.location(in: view)
            switch recognizer.state {
            case .began:
                let t = recognizer.translation(in: view)
                let start = CGPoint(x: location.x - t.x, y: location.y - t.y)
                dragStart = start
                parent.onDrag(.changed(start: start, location: location))
            case .changed:
                guard let start = dragStart else { return }
                parent.onDrag(.changed(start: start, location: location))
            case .ended:
                guard let start = dragStart else { return }
                dragStart = nil
                parent.onDrag(.ended(start: start, location: location))
            case .cancelled, .failed:
                guard dragStart != nil else { return }
                dragStart = nil
                parent.onDrag(.cancelled)
            default:
                break
            }
        }

        @objc func handleTap(_ recognizer: UITapGestureRecognizer) {
            parent.onTap(recognizer.location(in: host.view))
        }
    }
}

/// Fits the content on first layout and on rotation, and keeps it centered when it is
/// smaller than the screen.
final class FittingScrollView: UIScrollView {
    weak var contentView: UIView?
    private(set) var contentSizeInPoints: CGSize = .zero
    private var fittedBounds: CGSize = .zero

    func setContent(size: CGSize) {
        contentSizeInPoints = size
        zoomScale = 1
        contentView?.frame = CGRect(origin: .zero, size: size)
        contentSize = size
        fittedBounds = .zero
        setNeedsLayout()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        if bounds.size != fittedBounds, bounds.width > 0, bounds.height > 0 {
            let wasFitted = fittedBounds == .zero || abs(zoomScale - minimumZoomScale) < 0.001
            fittedBounds = bounds.size
            let fit = Self.fitScale(content: contentSizeInPoints, in: bounds.size)
            minimumZoomScale = fit
            maximumZoomScale = max(fit, 1) * 6
            if wasFitted || zoomScale < fit { zoomScale = fit }
            sharpenContent()
        }
        centerContent()
    }

    /// Zooming scales the rendered layers, which blurs the annotations. Once the zoom settles,
    /// render them again at the on-screen pixel density.
    func sharpenContent() {
        guard let contentView else { return }
        let scale = min(max(1, zoomScale), 8) * traitCollection.displayScale
        func apply(_ layer: CALayer) {
            layer.contentsScale = scale
            layer.rasterizationScale = scale
            layer.setNeedsDisplay()
            layer.sublayers?.forEach(apply)
        }
        contentView.contentScaleFactor = scale
        apply(contentView.layer)
    }

    /// Shows the whole image; small crops grow to fill the screen, since a phone shows them tiny.
    nonisolated static func fitScale(content: CGSize, in viewport: CGSize) -> CGFloat {
        guard content.width > 0, content.height > 0 else { return 1 }
        return min(viewport.width / content.width, viewport.height / content.height)
    }

    func centerContent() {
        let x = max(0, (bounds.width - contentSize.width) / 2)
        let y = max(0, (bounds.height - contentSize.height) / 2)
        let inset = UIEdgeInsets(top: y, left: x, bottom: y, right: x)
        if contentInset != inset { contentInset = inset }
    }
}

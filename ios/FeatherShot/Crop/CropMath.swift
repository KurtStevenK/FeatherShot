import CoreGraphics

/// Geometry of the crop screen. Rects are in image points unless the name says otherwise.
enum CropMath {
    enum Corner: CaseIterable { case topLeft, topRight, bottomLeft, bottomRight }

    /// Where an image of `image` size sits when shown aspect-fit and centered in `container`.
    static func fitFrame(image: CGSize, in container: CGSize) -> CGRect {
        guard image.width > 0, image.height > 0, container.width > 0, container.height > 0 else { return .zero }
        let scale = min(container.width / image.width, container.height / image.height)
        let size = CGSize(width: image.width * scale, height: image.height * scale)
        return CGRect(
            x: (container.width - size.width) / 2, y: (container.height - size.height) / 2,
            width: size.width, height: size.height
        )
    }

    /// A point on screen (in the container) to image points.
    static func imagePoint(_ viewPoint: CGPoint, frame: CGRect, imageSize: CGSize) -> CGPoint {
        guard frame.width > 0, frame.height > 0 else { return .zero }
        return CGPoint(
            x: (viewPoint.x - frame.minX) * imageSize.width / frame.width,
            y: (viewPoint.y - frame.minY) * imageSize.height / frame.height
        )
    }

    /// An image rect to screen (in the container).
    static func viewRect(_ imageRect: CGRect, frame: CGRect, imageSize: CGSize) -> CGRect {
        guard imageSize.width > 0, imageSize.height > 0 else { return .zero }
        let sx = frame.width / imageSize.width
        let sy = frame.height / imageSize.height
        return CGRect(
            x: frame.minX + imageRect.minX * sx, y: frame.minY + imageRect.minY * sy,
            width: imageRect.width * sx, height: imageRect.height * sy
        )
    }

    static func clamp(_ point: CGPoint, to bounds: CGRect) -> CGPoint {
        CGPoint(x: min(max(point.x, bounds.minX), bounds.maxX), y: min(max(point.y, bounds.minY), bounds.maxY))
    }

    /// The rect spanned by a drag from `a` to `b`, kept inside `bounds`.
    static func rect(from a: CGPoint, to b: CGPoint, in bounds: CGRect) -> CGRect {
        let p = clamp(a, to: bounds)
        let q = clamp(b, to: bounds)
        return CGRect(x: min(p.x, q.x), y: min(p.y, q.y), width: abs(q.x - p.x), height: abs(q.y - p.y))
    }

    /// `rect` shifted by `delta`, stopped at the edges of `bounds`.
    static func moved(_ rect: CGRect, by delta: CGSize, in bounds: CGRect) -> CGRect {
        var r = rect.offsetBy(dx: delta.width, dy: delta.height)
        r.origin.x = min(max(r.minX, bounds.minX), bounds.maxX - r.width)
        r.origin.y = min(max(r.minY, bounds.minY), bounds.maxY - r.height)
        return r
    }

    /// `rect` with `corner` dragged to `point`; the opposite corner stays put and the rect
    /// never gets smaller than `minSize` or leaves `bounds`.
    static func resized(_ rect: CGRect, corner: Corner, to point: CGPoint, in bounds: CGRect, minSize: CGFloat) -> CGRect {
        let p = clamp(point, to: bounds)
        var minX = rect.minX, maxX = rect.maxX, minY = rect.minY, maxY = rect.maxY
        switch corner {
        case .topLeft:
            minX = min(p.x, maxX - minSize); minY = min(p.y, maxY - minSize)
        case .topRight:
            maxX = max(p.x, minX + minSize); minY = min(p.y, maxY - minSize)
        case .bottomLeft:
            minX = min(p.x, maxX - minSize); maxY = max(p.y, minY + minSize)
        case .bottomRight:
            maxX = max(p.x, minX + minSize); maxY = max(p.y, minY + minSize)
        }
        let r = CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
        return r.intersection(bounds)
    }

    static func point(of corner: Corner, in rect: CGRect) -> CGPoint {
        switch corner {
        case .topLeft: return CGPoint(x: rect.minX, y: rect.minY)
        case .topRight: return CGPoint(x: rect.maxX, y: rect.minY)
        case .bottomLeft: return CGPoint(x: rect.minX, y: rect.maxY)
        case .bottomRight: return CGPoint(x: rect.maxX, y: rect.maxY)
        }
    }

    /// The pixel rect to cut from the bitmap: `rect` (points) times `scale`, snapped to whole
    /// pixels, inside the bitmap and at least one pixel.
    static func pixelRect(_ rect: CGRect, scale: CGFloat, pixelSize: CGSize) -> CGRect {
        let bounds = CGRect(origin: .zero, size: pixelSize)
        let scaled = CGRect(
            x: (rect.minX * scale).rounded(), y: (rect.minY * scale).rounded(),
            width: (rect.width * scale).rounded(), height: (rect.height * scale).rounded()
        )
        var r = scaled.intersection(bounds)
        if r.isNull || r.width < 1 || r.height < 1 {
            let x = min(max(scaled.minX, 0), max(pixelSize.width - 1, 0))
            let y = min(max(scaled.minY, 0), max(pixelSize.height - 1, 0))
            r = CGRect(x: x, y: y, width: 1, height: 1)
        }
        return r
    }
}

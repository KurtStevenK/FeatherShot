import CoreGraphics
import Testing
@testable import FeatherShot

struct CropMathTests {
    let bounds = CGRect(x: 0, y: 0, width: 393, height: 852)

    @Test func fitFrameCentersAndKeepsAspect() {
        let frame = CropMath.fitFrame(image: CGSize(width: 393, height: 852), in: CGSize(width: 393, height: 426))
        #expect(frame.height == 426)
        #expect(abs(frame.width - 196.5) < 0.001)
        #expect(abs(frame.midX - 196.5) < 0.001)
    }

    @Test func viewAndImagePointsRoundTrip() {
        let frame = CGRect(x: 20, y: 10, width: 196.5, height: 426)
        let image = CGSize(width: 393, height: 852)
        let p = CropMath.imagePoint(CGPoint(x: 20 + 98.25, y: 10 + 213), frame: frame, imageSize: image)
        #expect(p == CGPoint(x: 196.5, y: 426))
        let v = CropMath.viewRect(CGRect(x: 0, y: 0, width: 393, height: 852), frame: frame, imageSize: image)
        #expect(v == frame)
    }

    @Test func dragRectIsNormalizedAndClamped() {
        let r = CropMath.rect(from: CGPoint(x: 300, y: 900), to: CGPoint(x: -10, y: 100), in: bounds)
        #expect(r == CGRect(x: 0, y: 100, width: 300, height: 752))
    }

    @Test func moveStopsAtTheEdges() {
        let r = CGRect(x: 10, y: 10, width: 100, height: 100)
        #expect(CropMath.moved(r, by: CGSize(width: -50, height: 2000), in: bounds) == CGRect(x: 0, y: 752, width: 100, height: 100))
    }

    @Test func resizeKeepsOppositeCornerAndMinimum() {
        let r = CGRect(x: 100, y: 100, width: 100, height: 100)
        let grown = CropMath.resized(r, corner: .topLeft, to: CGPoint(x: 50, y: 40), in: bounds, minSize: 24)
        #expect(grown == CGRect(x: 50, y: 40, width: 150, height: 160))
        // Dragging past the opposite corner stops at the minimum size.
        let tiny = CropMath.resized(r, corner: .bottomRight, to: CGPoint(x: 0, y: 0), in: bounds, minSize: 24)
        #expect(tiny == CGRect(x: 100, y: 100, width: 24, height: 24))
    }

    @Test func pixelRectScalesSnapsAndClamps() {
        let pixels = CGSize(width: 1179, height: 2556)
        #expect(CropMath.pixelRect(CGRect(x: 10.2, y: 20, width: 100, height: 50), scale: 3, pixelSize: pixels)
                == CGRect(x: 31, y: 60, width: 300, height: 150))
        #expect(CropMath.pixelRect(CGRect(x: 380, y: 840, width: 100, height: 100), scale: 3, pixelSize: pixels)
                == CGRect(x: 1140, y: 2520, width: 39, height: 36))
        // Nothing left inside: still one valid pixel, never an empty crop.
        #expect(CropMath.pixelRect(CGRect(x: 500, y: 900, width: 10, height: 10), scale: 3, pixelSize: pixels).size
                == CGSize(width: 1, height: 1))
    }
}

import CoreGraphics
import Testing
@testable import FeatherShot

@Test func fitKeepsSmallImagesAtOriginalSize() {
    let scale = EditorZoom.fit.resolved(image: CGSize(width: 300, height: 200), viewport: CGSize(width: 900, height: 600))
    #expect(scale == 1)
}

@Test func fitShrinksLargeImagesIntoTheWindow() {
    let scale = EditorZoom.fit.resolved(image: CGSize(width: 2000, height: 1000), viewport: CGSize(width: 1000, height: 800))
    #expect(scale == 0.5)
}

@Test func zoomStepsWalkTheLevels() {
    #expect(EditorZoom.zoomedIn(from: 1) == 1.25)
    #expect(EditorZoom.zoomedOut(from: 1) == 0.75)
    // From an in-between fit scale the next level in each direction.
    #expect(EditorZoom.zoomedIn(from: 0.42) == 0.5)
    #expect(EditorZoom.zoomedOut(from: 0.42) == 0.33)
    #expect(EditorZoom.zoomedIn(from: 8) == nil)
    #expect(EditorZoom.zoomedOut(from: 0.1) == nil)
}

@Test func fixedScalesAreClamped() {
    let image = CGSize(width: 100, height: 100), viewport = CGSize(width: 100, height: 100)
    #expect(EditorZoom.scale(20).resolved(image: image, viewport: viewport) == 8)
    #expect(EditorZoom.scale(0.01).resolved(image: image, viewport: viewport) == 0.1)
    #expect(EditorZoom.percent(0.665) == "67%")
}

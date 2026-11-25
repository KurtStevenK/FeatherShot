import Foundation
import SwiftUI
import Testing
@testable import FeatherShot

// MARK: - Text tool rules (shared by the Mac and iPhone editors)

private func text(_ string: String, at point: CGPoint = CGPoint(x: 100, y: 100), fontSize: CGFloat = 20) -> DrawingElement {
    DrawingElement(tool: .text, start: point, end: point, color: .red, lineWidth: 4, text: string, fontSize: fontSize)
}

@Test func commitKeepsTrimmedText() {
    let typed = text("  Hello  ")
    var drawings = [typed]
    #expect(TextAnnotation.commit(typed.id, in: &drawings) == .kept)
    #expect(drawings.count == 1)
    #expect(drawings[0].text == "Hello")
}

@Test func commitRemovesTextWithNothingTyped() {
    let arrow = DrawingElement(tool: .arrow, start: .zero, end: CGPoint(x: 10, y: 10), color: .red, lineWidth: 4)
    for typed in ["", "   ", "\n\t "] {
        let open = text(typed)
        var drawings = [arrow, open]
        #expect(TextAnnotation.commit(open.id, in: &drawings) == .removed)
        #expect(drawings.map(\.id) == [arrow.id])
    }
}

@Test func commitOfUnknownTextChangesNothing() {
    let kept = text("Hello")
    var drawings = [kept]
    #expect(TextAnnotation.commit(UUID(), in: &drawings) == .notFound)
    #expect(drawings.map(\.id) == [kept.id])
    #expect(drawings[0].text == "Hello")
}

@Test func fontSizeFollowsLineWidth() {
    #expect(TextAnnotation.fontSize(lineWidth: 2) == 18)
    #expect(TextAnnotation.fontSize(lineWidth: 4) == 20)
    #expect(TextAnnotation.fontSize(lineWidth: 15) == 75)
}

@Test func hitFindsTheTopmostTextAroundItsCenter() {
    // "Hi" at 20 pt is narrower than the 80 pt minimum: x 60...140, y 86...114.
    let below = text("Hi")
    let above = text("Hi", at: CGPoint(x: 110, y: 100))
    let arrow = DrawingElement(tool: .arrow, start: CGPoint(x: 0, y: 100), end: CGPoint(x: 200, y: 100), color: .red, lineWidth: 4)
    let drawings = [below, above, arrow]
    #expect(TextAnnotation.hit(in: drawings, at: CGPoint(x: 100, y: 100)) == above.id)
    #expect(TextAnnotation.hit(in: drawings, at: CGPoint(x: 62, y: 100)) == below.id)
    #expect(TextAnnotation.hit(in: drawings, at: CGPoint(x: 100, y: 120)) == nil)
    #expect(TextAnnotation.hit(in: [below], at: CGPoint(x: 145, y: 100)) == nil)
    #expect(TextAnnotation.hit(in: [below], at: CGPoint(x: 145, y: 100), slop: 10) == below.id)
}

@Test func hitKeepsAPressOnTheOpenFieldInIt() {
    // The field has room for the caret beside the text (9 pt at 20 pt), and wins over a text on top.
    let open = text("Hi")
    let other = text("Hi", at: CGPoint(x: 200, y: 100))
    let drawings = [open, other]
    #expect(TextAnnotation.hit(in: drawings, at: CGPoint(x: 145, y: 100)) == nil)
    #expect(TextAnnotation.hit(in: drawings, at: CGPoint(x: 145, y: 100), editing: open.id) == open.id)
    #expect(TextAnnotation.hit(in: drawings, at: CGPoint(x: 165, y: 100), editing: open.id) == other.id)
}

@Test func emptyTextIsAsWideAsThePlaceholder() {
    let empty = text("")
    let expectedWidth = CGFloat(TextAnnotation.placeholder.count) * 20 * 0.55
    #expect(abs(TextAnnotation.bounds(of: empty).width - expectedWidth) < 0.001)
    #expect(TextAnnotation.bounds(of: empty).midX == 100)
    #expect(TextAnnotation.bounds(of: empty).midY == 100)
}

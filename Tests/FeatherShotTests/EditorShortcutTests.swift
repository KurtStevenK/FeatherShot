import Foundation
import SwiftUI
import Testing
@testable import FeatherShot

/// Tool ids of the Electron editor (`setTool('…')`) and the matching macOS tools.
private let electronTools: [String: Tool] = [
    "step-arrow": .stepArrow, "step-rect": .stepRectangle, "arrow": .arrow, "rect": .rectangle,
    "circle": .circle, "line": .line, "question-arrow": .questionArrow, "question-rect": .questionRectangle,
    "exclamation-arrow": .exclamationArrow, "exclamation-rect": .exclamationRectangle, "text": .text,
    "abc-arrow": .abcArrow, "abc-rect": .abcRectangle, "magnifier": .magnifier,
]

/// Every `e.key === '…'` → `setTool('…')` pair in the Electron editor's keydown handler.
private func electronToolKeys() throws -> [(key: String, tool: String)] {
    let appJS = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .appendingPathComponent("electron-app/renderer/app.js")
    let source = try String(contentsOf: appJS, encoding: .utf8)
    var pairs: [(key: String, tool: String)] = []
    for line in source.split(separator: "\n") where line.contains("e.key ===") {
        guard let tool = line.firstMatch(of: #/setTool\('([a-z-]+)'\)/#)?.1 else { continue }
        for key in line.matches(of: #/e\.key === '(.)'/#) {
            pairs.append((String(key.1), String(tool)))
        }
    }
    return pairs
}

@Test func toolKeysMatchElectronEditor() throws {
    let electron = try electronToolKeys()
    #expect(electron.count == EditorShortcut.toolKeys.count)
    for (key, tool) in electron {
        let expected = try #require(electronTools[tool], "Unknown Electron tool \(tool)")
        #expect(EditorShortcut.match(key, modifiers: [], isEditingText: false) == .select(expected), "key \(key)")
    }
}

@Test func shiftedCharactersSelectTools() {
    // German layout: = is ⇧0 and _ is ⇧-.
    #expect(EditorShortcut.match("=", modifiers: .shift, isEditingText: false) == .select(.exclamationRectangle))
    #expect(EditorShortcut.match("_", modifiers: .shift, isEditingText: false) == .select(.exclamationArrow))
    #expect(EditorShortcut.match("T", modifiers: .shift, isEditingText: false) == .select(.text))
    #expect(EditorShortcut.match("3", modifiers: .numericPad, isEditingText: false) == .select(.arrow))
    // Like Electron, only the lowercase letter is an alias.
    #expect(EditorShortcut.match("A", modifiers: .shift, isEditingText: false) == nil)
}

@Test func commandUndoAndSave() {
    #expect(EditorShortcut.match("z", modifiers: .command, isEditingText: false) == .undo)
    #expect(EditorShortcut.match("s", modifiers: .command, isEditingText: false) == .saveAndCopy)
    #expect(EditorShortcut.match("Z", modifiers: [.command, .capsLock], isEditingText: false) == .undo)
    #expect(EditorShortcut.match("z", modifiers: [.command, .shift], isEditingText: false) == nil)
    #expect(EditorShortcut.match("s", modifiers: [.command, .option], isEditingText: false) == nil)
    #expect(EditorShortcut.match("z", modifiers: .control, isEditingText: false) == nil)
}

@Test func modifiedToolKeysPassThrough() {
    for modifiers: EventModifiers in [.command, .control, .option] {
        #expect(EditorShortcut.match("3", modifiers: modifiers, isEditingText: false) == nil)
    }
    #expect(EditorShortcut.match("x", modifiers: [], isEditingText: false) == nil)
}

@Test func textEditingKeepsKeysExceptSave() {
    for key in EditorShortcut.toolKeys.keys {
        #expect(EditorShortcut.match(key, modifiers: [], isEditingText: true) == nil, "key \(key)")
    }
    #expect(EditorShortcut.match("z", modifiers: .command, isEditingText: true) == nil)
    #expect(EditorShortcut.match("s", modifiers: .command, isEditingText: true) == .saveAndCopy)
}

@Test func commandZoomKeys() {
    #expect(EditorShortcut.match("+", modifiers: .command, isEditingText: false) == .zoomIn)
    #expect(EditorShortcut.match("+", modifiers: [.command, .shift], isEditingText: false) == .zoomIn)
    #expect(EditorShortcut.match("=", modifiers: .command, isEditingText: false) == .zoomIn)
    #expect(EditorShortcut.match("-", modifiers: .command, isEditingText: false) == .zoomOut)
    #expect(EditorShortcut.match("0", modifiers: .command, isEditingText: false) == .actualSize)
    #expect(EditorShortcut.match("9", modifiers: .command, isEditingText: false) == .zoomToFit)
    #expect(EditorShortcut.match("0", modifiers: [.command, .option], isEditingText: false) == nil)
    // Without ⌘ these keys stay tool shortcuts.
    #expect(EditorShortcut.match("-", modifiers: [], isEditingText: false) == .select(.exclamationArrow))
    #expect(EditorShortcut.match("0", modifiers: [], isEditingText: false) == .select(.abcRectangle))
}

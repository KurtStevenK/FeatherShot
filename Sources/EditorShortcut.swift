import SwiftUI

/// Keyboard shortcuts of the annotation editor: the keys of the Electron editor
/// (`electron-app/renderer/app.js`), with ⌘ in place of Ctrl/Cmd.
enum EditorShortcut: Equatable {
    case select(Tool)
    case undo
    case saveAndCopy
    case zoomIn, zoomOut, actualSize, zoomToFit

    /// Tool keys by the character they type, so `-`, `=` and `+` follow the keyboard layout
    /// (on a German keyboard `=` is ⇧0).
    static let toolKeys: [String: Tool] = [
        "1": .stepArrow,
        "2": .stepRectangle,
        "3": .arrow, "a": .arrow,
        "4": .rectangle, "r": .rectangle,
        "5": .circle,
        "6": .line, "l": .line,
        "7": .questionArrow,
        "8": .questionRectangle,
        "9": .abcArrow,
        "0": .abcRectangle,
        "-": .exclamationArrow, "_": .exclamationArrow,
        "=": .exclamationRectangle, "+": .exclamationRectangle,
        "t": .text, "T": .text,
        "m": .magnifier, "M": .magnifier,
    ]

    /// The shortcut for a key press, or nil to let the key through.
    /// While a text annotation is being edited its keys belong to the text field; only ⌘S
    /// (Save & Copy commits the text first) and the ⌘ zoom keys still work.
    static func match(_ characters: String, modifiers: EventModifiers, isEditingText: Bool) -> EditorShortcut? {
        if modifiers.contains(.command) {
            guard modifiers.isDisjoint(with: [.option, .control]) else { return nil }
            // ⌘+ is ⌘⇧= on a US keyboard and its own key on a German one.
            if characters == "+" || characters == "=" { return .zoomIn }
            guard !modifiers.contains(.shift) else { return nil }
            switch characters.lowercased() {
            case "s": return .saveAndCopy
            case "z": return isEditingText ? nil : .undo
            case "-": return .zoomOut
            case "0": return .actualSize
            case "9": return .zoomToFit
            default: return nil
            }
        }
        // SwiftUI reports ⌥ and ⌃ combinations with the plain character (⌥1 arrives as "1",
        // ⌥L — @ on a German keyboard — as "l"), so they are ruled out here.
        guard !isEditingText, modifiers.isDisjoint(with: [.option, .control]) else { return nil }
        return toolKeys[characters].map(EditorShortcut.select)
    }
}

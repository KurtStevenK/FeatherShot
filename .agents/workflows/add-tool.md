---
description: How to add a new drawing/annotation tool to FeatherShot
---

# Add a New Drawing Tool

This workflow walks through adding a new annotation tool to FeatherShot. Every tool requires changes in exactly **2 files** across **4 locations**.

## Step 1 — Add Case to Tool Enum

In `Sources/DrawingShapes.swift`, add a new case to the `Tool` enum:

```swift
enum Tool {
    case arrow, rectangle, stepArrow, myNewTool
}
```

## Step 2 — Create the Tool View

In `Sources/DrawingShapes.swift`, create a new SwiftUI `View` struct for your tool:

```swift
struct MyNewToolView: View {
    var start: CGPoint
    var end: CGPoint
    var color: Color
    var lineWidth: CGFloat
    // Add any additional properties (e.g., stepNumber for StepArrowView)
    
    var body: some View {
        // Your drawing implementation
    }
}
```

**Guidelines:**
- Accept at minimum: `start`, `end`, `color`, `lineWidth`
- Use `Path` for custom shapes, `Shape` protocol for stroked outlines
- Keep the view self-contained — it receives all data via parameters

## Step 3 — Add Rendering to the Canvas

In `Sources/AnnotationView.swift`, update the `drawingContent` computed property.

### Completed drawings (inside `ForEach`):

```swift
} else if drawing.tool == .myNewTool {
    MyNewToolView(start: drawing.start, end: drawing.end, color: drawing.color, lineWidth: drawing.lineWidth)
}
```

### Active drawing (inside the `if let start = currentStart, let end = currentEnd` block):

```swift
} else if selectedTool == .myNewTool {
    MyNewToolView(start: start, end: end, color: selectedColor, lineWidth: lineWidth)
}
```

> **Important:** The `drawingContent` view is used by both the live canvas AND the `ImageRenderer` for export. Any tool that renders here will automatically appear in the exported image.

## Step 4 — Add Toolbar Button

In `Sources/AnnotationView.swift`, add a button in the `toolbar` computed property's tool selection `HStack`:

```swift
Divider().frame(height: 20)

Button(action: { selectedTool = .myNewTool }) {
    Image(systemName: "star")  // Choose an appropriate SF Symbol
        .padding(8)
        .background(selectedTool == .myNewTool ? Color.blue : Color.clear)
        .foregroundColor(selectedTool == .myNewTool ? .white : .primary)
}
.buttonStyle(.plain)
```

**SF Symbol Picker:** Browse symbols at [developer.apple.com/sf-symbols](https://developer.apple.com/sf-symbols/)

## Checklist

- [ ] `DrawingShapes.swift` — New case in `Tool` enum
- [ ] `DrawingShapes.swift` — New View struct
- [ ] `AnnotationView.swift` → `drawingContent` — Render completed + active drawings
- [ ] `AnnotationView.swift` → `toolbar` — Toolbar button with SF Symbol
- [ ] Test: Draw the new tool, undo it, export with Save & Copy
- [ ] Update `README.md` tool table
- [ ] Update `CHANGELOG.md`

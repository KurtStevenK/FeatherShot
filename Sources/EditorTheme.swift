import SwiftUI

/// The editor's look, taken from the website (`hosting/public/style.css`): deep navy surfaces,
/// hairline borders and the blue → cyan accent. The Electron editor's `style.css` uses the same tokens.
enum EditorTheme {
    static let background = Color(hex: 0x0A0A1A)
    static let canvas = Color(hex: 0x07071A)
    static let bar = Color(hex: 0x0E0E22)
    static let card = Color(hex: 0x12122A)
    static let border = Color.white.opacity(0.07)
    static let text = Color(hex: 0xE0E4F0)
    static let muted = Color(hex: 0x8890A8)
    static let blue = Color(hex: 0x0066FF)
    static let cyan = Color(hex: 0x00CCCC)
    static let link = Color(hex: 0x6CB4FF)
    static let success = Color(hex: 0x30D158)
    static let danger = Color(hex: 0xFF453A)

    /// The website's primary button gradient.
    static let accent = LinearGradient(
        colors: [blue, Color(hex: 0x0088EE)], startPoint: .topLeading, endPoint: .bottomTrailing
    )
    /// The brand gradient of the logo text, used for the selected tool.
    static let brand = LinearGradient(
        colors: [blue, cyan], startPoint: .topLeading, endPoint: .bottomTrailing
    )

    /// Annotation colors offered as swatches; the color well next to them picks any other.
    static let swatches: [Color] = [
        Color(hex: 0xFF3B30), Color(hex: 0xFF9500), Color(hex: 0xFFCC00),
        Color(hex: 0x34C759), Color(hex: 0x0A84FF), Color(hex: 0xAF52DE), .white,
    ]
}

extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

// MARK: - Controls

/// A square icon button of the tool palette and the zoom control.
struct EditorIconButtonStyle: ButtonStyle {
    var isSelected = false
    var size: CGFloat = 30

    func makeBody(configuration: Configuration) -> some View {
        EditorIconButtonBody(configuration: configuration, isSelected: isSelected, size: size)
    }
}

private struct EditorIconButtonBody: View {
    let configuration: ButtonStyleConfiguration
    let isSelected: Bool
    let size: CGFloat
    @State private var isHovered = false
    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        configuration.label
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(isSelected ? Color.white : (isHovered ? EditorTheme.text : EditorTheme.muted))
            .frame(width: size, height: size)
            .background {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(isSelected ? AnyShapeStyle(EditorTheme.brand) : AnyShapeStyle(Color.white.opacity(isHovered ? 0.08 : 0)))
                    .shadow(color: isSelected ? EditorTheme.blue.opacity(0.45) : .clear, radius: 6, y: 2)
            }
            .scaleEffect(configuration.isPressed ? 0.92 : 1)
            .opacity(isEnabled ? 1 : 0.35)
            .contentShape(Rectangle())
            .onHover { isHovered = $0 }
            .animation(.easeOut(duration: 0.12), value: isHovered)
            .animation(.easeOut(duration: 0.12), value: isSelected)
    }
}

/// The website's buttons: `.primary` is the blue gradient, `.ghost` the translucent outline.
struct EditorPillButtonStyle: ButtonStyle {
    enum Kind { case primary, ghost, danger, success }
    var kind: Kind

    func makeBody(configuration: Configuration) -> some View {
        EditorPillButtonBody(configuration: configuration, kind: kind)
    }
}

private struct EditorPillButtonBody: View {
    let configuration: ButtonStyleConfiguration
    let kind: EditorPillButtonStyle.Kind
    @State private var isHovered = false
    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        configuration.label
            .font(.system(size: 12.5, weight: kind == .primary || kind == .success ? .semibold : .medium))
            .foregroundStyle(foreground)
            .padding(.horizontal, kind == .primary || kind == .success ? 16 : 12)
            .frame(height: 32)
            .background {
                RoundedRectangle(cornerRadius: 10, style: .continuous).fill(fill)
            }
            .overlay {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .strokeBorder(stroke, lineWidth: 1)
            }
            .shadow(color: glow, radius: isHovered ? 14 : 10, y: isHovered ? 4 : 3)
            .offset(y: isHovered && isEnabled && kind == .primary ? -1 : 0)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .opacity(isEnabled ? 1 : 0.4)
            .contentShape(Rectangle())
            .onHover { isHovered = $0 }
            .animation(.easeOut(duration: 0.15), value: isHovered)
    }

    private var foreground: Color {
        switch kind {
        case .primary, .success: return .white
        case .ghost: return isHovered ? .white : EditorTheme.text
        case .danger: return EditorTheme.danger
        }
    }

    private var fill: AnyShapeStyle {
        switch kind {
        case .primary: return AnyShapeStyle(EditorTheme.accent)
        case .success: return AnyShapeStyle(EditorTheme.success)
        case .ghost: return AnyShapeStyle(Color.white.opacity(isHovered ? 0.1 : 0.06))
        case .danger: return AnyShapeStyle(EditorTheme.danger.opacity(isHovered ? 0.14 : 0.06))
        }
    }

    private var stroke: Color {
        switch kind {
        case .primary, .success: return .white.opacity(0.12)
        case .ghost: return .white.opacity(0.12)
        case .danger: return EditorTheme.danger.opacity(0.25)
        }
    }

    private var glow: Color {
        switch kind {
        case .primary: return EditorTheme.blue.opacity(isHovered ? 0.45 : 0.3)
        case .success: return EditorTheme.success.opacity(0.35)
        case .ghost, .danger: return .clear
        }
    }
}

/// A rounded group of controls, like the website's cards.
struct EditorGroup<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        HStack(spacing: 2) { content }
            .padding(3)
            .background {
                RoundedRectangle(cornerRadius: 11, style: .continuous).fill(EditorTheme.card)
            }
            .overlay {
                RoundedRectangle(cornerRadius: 11, style: .continuous).strokeBorder(EditorTheme.border, lineWidth: 1)
            }
    }
}

/// The dotted backdrop behind the screenshot, with the website's soft blue glow.
struct EditorCanvasBackdrop: View {
    var body: some View {
        ZStack {
            EditorTheme.canvas
            RadialGradient(
                colors: [EditorTheme.blue.opacity(0.10), EditorTheme.cyan.opacity(0.04), .clear],
                center: .center, startRadius: 0, endRadius: 520
            )
            Canvas { context, size in
                let spacing: CGFloat = 22
                let dot = Path(ellipseIn: CGRect(x: 0, y: 0, width: 1.4, height: 1.4))
                var y: CGFloat = spacing / 2
                while y < size.height {
                    var x: CGFloat = spacing / 2
                    while x < size.width {
                        context.fill(dot.offsetBy(dx: x, dy: y), with: .color(.white.opacity(0.06)))
                        x += spacing
                    }
                    y += spacing
                }
            }
        }
    }
}

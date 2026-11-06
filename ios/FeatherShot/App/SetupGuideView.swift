import SwiftUI

/// The setup guide, shown on first launch and before the share sheet: an animated intro, then one
/// step per screen with what to tap, advanced with Next. An app cannot put its own hints into the
/// system share sheet, Shortcuts or Settings, so they are shown here first.
/// The scenes are drawn in SwiftUI (not screenshots), so they stay sharp and never go stale.
struct SetupGuideView: View {
    let shortcutFile: URL

    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var scene = 0

    /// iPad has no Action Button: there the shortcut goes into Control Center.
    private static var scenes: [(title: LocalizedStringKey, caption: LocalizedStringKey)] {
        Device.isPad ? [
            ("Screenshot with one tap", "Tap FeatherShot Screenshot in Control Center. FeatherShot opens with the screenshot: select the area, annotate, Save & Copy."),
            ("Tap **Shortcuts**", "In the share sheet, choose the Shortcuts app."),
            ("Tap **Add Shortcut**", "Shortcuts shows FeatherShot Screenshot. Add it."),
            ("Add it to Control Center", "Open **Control Center**, tap **+ › Add a Control › Shortcut**, choose **FeatherShot Screenshot**."),
            ("Tap it in any app", "The first time, tap **Always Allow**. FeatherShot opens with your screenshot."),
        ] : [
            ("Screenshot with one press", "Press the Action Button in any app. FeatherShot opens with the screenshot: select the area, annotate, Save & Copy."),
            ("Tap **Shortcuts**", "In the share sheet, choose the Shortcuts app."),
            ("Tap **Add Shortcut**", "Shortcuts shows FeatherShot Screenshot. Add it."),
            ("Pick it for the Action Button", "**Settings › Action Button**, swipe to **Shortcut**, choose **FeatherShot Screenshot**."),
            ("Press the Action Button", "The first time, tap **Always Allow**. FeatherShot opens with your screenshot."),
        ]
    }

    var body: some View {
        VStack(spacing: 18) {
            Image("Logo")
                .resizable()
                .frame(width: 36, height: 36)
                .shadow(color: EditorTheme.blue.opacity(0.35), radius: 8, y: 3)
                .padding(.top, 16)
                .accessibilityHidden(true)
            Text(scene == 0 ? "Welcome to FeatherShot" : Device.isPad ? "Set up the shortcut" : "Set up the Action Button")
                .font(.title3.weight(.bold))
                .foregroundStyle(EditorTheme.text)

            MockPhone {
                ZStack {
                    switch scene {
                    case 0: IntroScene()
                    case 1: ShareSheetScene()
                    case 2: ImportScene()
                    case 3: if Device.isPad { ControlCenterScene() } else { ActionButtonScene() }
                    default: PressScene()
                    }
                }
                .transition(.opacity)
                .id(scene)
            }
            .frame(height: 300)
            .accessibilityHidden(true)

            VStack(spacing: 6) {
                Text(scene == 0 ? (Device.isPad ? "FeatherShot for iPad" : "FeatherShot for iPhone") : "Step \(scene) of \(Self.scenes.count - 1)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(EditorTheme.link)
                Text(Self.scenes[scene].title)
                    .font(.headline)
                    .foregroundStyle(EditorTheme.text)
                Text(Self.scenes[scene].caption)
                    .font(.subheadline)
                    .foregroundStyle(EditorTheme.muted)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(minHeight: 96, alignment: .top)
            .padding(.horizontal, 24)
            .accessibilityElement(children: .combine)

            HStack(spacing: 8) {
                ForEach(Self.scenes.indices, id: \.self) { index in
                    Button { withAnimation(.easeInOut(duration: 0.3)) { scene = index } } label: {
                        Capsule()
                            .fill(index == scene ? EditorTheme.blue : EditorTheme.border)
                            .frame(width: index == scene ? 22 : 8, height: 8)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Step \(index + 1)")
                }
            }

            Spacer(minLength: 0)

            if scene < Self.scenes.count - 1 {
                Button {
                    withAnimation(.easeInOut(duration: 0.3)) { scene += 1 }
                } label: {
                    Text(scene == 0 ? (Device.isPad ? "Set Up the Shortcut" : "Set Up the Action Button") : "Next").frame(maxWidth: .infinity)
                }
                .buttonStyle(EditorPillButtonStyle(kind: .primary))
                .padding(.horizontal, 24)
            } else {
                ShareLink(
                    item: shortcutFile,
                    preview: SharePreview("FeatherShot Screenshot", icon: Image("Logo"))
                ) {
                    Label("Add the Shortcut", systemImage: "square.2.layers.3d").frame(maxWidth: .infinity)
                }
                .buttonStyle(EditorPillButtonStyle(kind: .primary))
                .padding(.horizontal, 24)
            }

            HStack {
                if scene > 0 {
                    Button("Back") { withAnimation(.easeInOut(duration: 0.3)) { scene -= 1 } }
                }
                Spacer()
                Button("Not Now") { dismiss() }
            }
            .font(.subheadline)
            .foregroundStyle(EditorTheme.muted)
            .padding(.horizontal, 28)
            .padding(.bottom, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(EditorTheme.background.ignoresSafeArea())
        .environment(\.guidePulse, !reduceMotion)
    }
}

// MARK: - Pieces

private struct GuidePulseKey: EnvironmentKey { static let defaultValue = true }

private extension EnvironmentValues {
    var guidePulse: Bool {
        get { self[GuidePulseKey.self] }
        set { self[GuidePulseKey.self] = newValue }
    }
}

/// A simplified iPhone outline the scenes are drawn in.
private struct MockPhone<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        RoundedRectangle(cornerRadius: 34, style: .continuous)
            .fill(Color(white: 0.11))
            .overlay(content.clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous)).padding(8))
            .overlay(
                RoundedRectangle(cornerRadius: 34, style: .continuous).strokeBorder(Color.white.opacity(0.18), lineWidth: 2)
            )
            .overlay(alignment: .top) {
                Capsule().fill(.black).frame(width: 54, height: 16).padding(.top, 14)
            }
            .aspectRatio(0.49, contentMode: .fit)
    }
}

/// The finger: a ring that pulses where the user should tap.
private struct TapMarker: View {
    @Environment(\.guidePulse) private var pulse

    var body: some View {
        ZStack {
            Circle().fill(Color.white.opacity(0.35)).frame(width: 30, height: 30)
            Circle().strokeBorder(Color.white, lineWidth: 2.5).frame(width: 30, height: 30)
        }
        .phaseAnimator(pulse ? [false, true] : [false]) { view, pressed in
            view.scaleEffect(pressed ? 0.75 : 1.15).opacity(pressed ? 1 : 0.7)
        } animation: { _ in .easeInOut(duration: 0.6) }
        .allowsHitTesting(false)
    }
}

private struct AppTile: View {
    var body: some View {
        Image("Logo").resizable().frame(width: 30, height: 30)
    }
}

private struct ShortcutsGlyph: View {
    var size: CGFloat = 34
    var body: some View {
        RoundedRectangle(cornerRadius: size * 0.24, style: .continuous)
            .fill(LinearGradient(colors: [Color(hex: 0x5B2BD8), Color(hex: 0x2A1270)], startPoint: .top, endPoint: .bottom))
            .frame(width: size, height: size)
            .overlay(
                Image(systemName: "square.2.layers.3d.fill")
                    .font(.system(size: size * 0.5))
                    .foregroundStyle(LinearGradient(colors: [.pink, .purple], startPoint: .top, endPoint: .bottom))
            )
    }
}

// MARK: - Scenes

/// 0. The whole flow, looping like a GIF: press the Action Button in some app, select the area,
/// draw an arrow, Save & Copy, then back to the home screen.
private struct IntroScene: View {
    @Environment(\.guidePulse) private var animate

    private enum Phase: Int, CaseIterable, Comparable {
        case app, press, flash, selectStart, selectEnd, annotate, save, done, home
        static func < (a: Phase, b: Phase) -> Bool { a.rawValue < b.rawValue }
    }

    var body: some View {
        PhaseAnimator(animate ? Phase.allCases : [.annotate]) { phase in
            ZStack(alignment: .topLeading) {
                screen(for: phase)
                Color.white.opacity(phase == .flash ? 0.9 : 0).allowsHitTesting(false)
                // The Action Button on the left edge, lit while pressed.
                Capsule()
                    .fill(phase == .press ? Color.orange : Color(white: 0.5))
                    .frame(width: 5, height: 22)
                    .offset(x: -1, y: 64)
                if phase == .press {
                    TapMarker().scaleEffect(0.7).offset(x: -6, y: 60)
                }
            }
            .overlay(alignment: .bottom) { caption(for: phase) }
        } animation: { phase in
            // The delay is how long the previous step stays on screen.
            switch phase {
            case .app: .easeInOut(duration: 0.3).delay(1.2)
            case .press: .easeIn(duration: 0.3).delay(1.0)
            case .flash: .easeOut(duration: 0.2).delay(0.8)
            case .selectStart: .easeOut(duration: 0.3)
            case .selectEnd: .easeInOut(duration: 0.9).delay(0.5)
            case .annotate: .spring(duration: 0.6).delay(0.9)
            case .save: .easeInOut(duration: 0.3).delay(1.2)
            case .done: .easeInOut(duration: 0.3).delay(0.9)
            case .home: .easeInOut(duration: 0.4).delay(1.4)
            }
        }
    }

    @ViewBuilder
    private func screen(for phase: Phase) -> some View {
        switch phase {
        case .app, .press, .flash: SomeApp()
        case .selectStart, .selectEnd: CropPreview(selected: phase == .selectEnd)
        case .annotate, .save: EditorPreview(pressingSave: phase == .save)
        case .done: DonePreview()
        case .home: HomePreview()
        }
    }

    private func caption(for phase: Phase) -> some View {
        let text: String = switch phase {
        case .app: "In any app…"
        case .press, .flash: Device.isPad ? "1  Tap the shortcut" : "1  Press the Action Button"
        case .selectStart, .selectEnd: "2  Select the area"
        case .annotate: "3  Annotate"
        case .save: "4  Tap Save & Copy"
        case .done: "Saved to Photos and copied"
        case .home: "5  Swipe home, paste it anywhere"
        }
        return Text(text)
            .font(.system(size: 9, weight: .semibold))
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .foregroundStyle(.white)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(Capsule().fill(Color.black.opacity(0.75)))
            .padding(.bottom, 12)
    }

    /// Any app: a few rows of content.
    private struct SomeApp: View {
        var rows = 6
        var body: some View {
            VStack(alignment: .leading, spacing: 8) {
                RoundedRectangle(cornerRadius: 4).fill(Color(white: 0.8)).frame(width: 70, height: 10)
                ForEach(0..<rows, id: \.self) { row in
                    HStack(spacing: 6) {
                        Circle().fill([Color.blue, .green, .orange, .pink, .purple, .teal][row % 6].opacity(0.7)).frame(width: 16, height: 16)
                        VStack(alignment: .leading, spacing: 3) {
                            RoundedRectangle(cornerRadius: 2).fill(Color(white: 0.75)).frame(width: 70, height: 5)
                            RoundedRectangle(cornerRadius: 2).fill(Color(white: 0.85)).frame(width: 46, height: 5)
                        }
                    }
                }
            }
            .padding(.top, 36)
            .padding(.horizontal, 14)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(Color.white)
        }
    }

    private struct MiniBar<Trailing: View>: View {
        let title: String
        @ViewBuilder var trailing: Trailing
        var body: some View {
            HStack {
                Text("Cancel").font(.system(size: 6)).foregroundStyle(EditorTheme.muted)
                Spacer()
                Text(title).font(.system(size: 7, weight: .semibold)).foregroundStyle(.white).lineLimit(1)
                Spacer()
                trailing
            }
            .padding(.top, 30)
            .padding(.horizontal, 10)
        }
    }

    /// Select Area: the screenshot, and a selection growing over the first rows.
    private struct CropPreview: View {
        let selected: Bool
        var body: some View {
            VStack(spacing: 6) {
                MiniBar(title: "Select Area") {
                    Text("Next").font(.system(size: 6, weight: .semibold)).foregroundStyle(.white)
                        .padding(.horizontal, 5).padding(.vertical, 2)
                        .background(Capsule().fill(EditorTheme.blue))
                }
                ZStack(alignment: .topLeading) {
                    SomeApp()
                    Color.black.opacity(0.45)
                        .mask {
                            Rectangle().overlay(alignment: .topLeading) {
                                Rectangle().frame(width: selected ? 100 : 24, height: selected ? 66 : 16)
                                    .offset(x: 10, y: 26).blendMode(.destinationOut)
                            }
                            .compositingGroup()
                        }
                    RoundedRectangle(cornerRadius: 1)
                        .strokeBorder(Color.white, lineWidth: 1.5)
                        .frame(width: selected ? 100 : 24, height: selected ? 66 : 16)
                        .offset(x: 10, y: 26)
                    TapMarker().scaleEffect(0.6)
                        .offset(x: selected ? 96 : 20, y: selected ? 78 : 28)
                }
                .clipShape(RoundedRectangle(cornerRadius: 6))
                .padding(.horizontal, 8)
                .padding(.bottom, 8)
            }
            .background(EditorTheme.background)
        }
    }

    /// The editor: the selected rows, enlarged, with a numbered arrow; then Save & Copy pressed.
    private struct EditorPreview: View {
        let pressingSave: Bool
        var body: some View {
            VStack(spacing: 6) {
                MiniBar(title: "") {
                    Text("Save & Copy").font(.system(size: 6, weight: .semibold)).foregroundStyle(.white)
                        .padding(.horizontal, 5).padding(.vertical, 2)
                        .background(Capsule().fill(EditorTheme.blue))
                        .overlay { if pressingSave { TapMarker().scaleEffect(0.6) } }
                }
                HStack(spacing: 5) {
                    ForEach(["list.number", "arrow.up.right", "square", "circle", "textformat"], id: \.self) { icon in
                        Image(systemName: icon).font(.system(size: 7, weight: .semibold))
                            .foregroundStyle(icon == "list.number" ? .white : EditorTheme.muted)
                            .frame(width: 14, height: 14)
                            .background(RoundedRectangle(cornerRadius: 3).fill(icon == "list.number" ? EditorTheme.blue : .clear))
                    }
                }
                ZStack(alignment: .topLeading) {
                    SomeApp(rows: 2).scaleEffect(1.25, anchor: .topLeading)
                    StepArrowView(
                        start: CGPoint(x: 92, y: 96), end: CGPoint(x: 44, y: 62),
                        color: EditorTheme.swatches[0], lineWidth: 2.5, stepNumber: 1
                    )
                }
                .frame(height: 150)
                .clipShape(RoundedRectangle(cornerRadius: 6))
                .padding(.horizontal, 8)
                Spacer(minLength: 0)
            }
            .background(EditorTheme.background)
        }
    }

    private struct DonePreview: View {
        var body: some View {
            VStack(spacing: 8) {
                Image(systemName: "checkmark.circle.fill").font(.system(size: 30)).foregroundStyle(EditorTheme.success)
                Text("Saved & Copied").font(.system(size: 9, weight: .bold)).foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(EditorTheme.background)
        }
    }

    /// The home screen, with Photos holding the new image.
    private struct HomePreview: View {
        var body: some View {
            let colors: [Color] = [.green, .blue, .orange, .gray, .red, .teal, .indigo, .pink, .yellow, .mint, .cyan, .purple]
            VStack {
                LazyVGrid(columns: Array(repeating: GridItem(.fixed(22), spacing: 10), count: 4), spacing: 12) {
                    ForEach(colors.indices, id: \.self) { i in
                        if i == 1 {
                            Image("Logo").resizable().frame(width: 22, height: 22)
                        } else if i == 2 {
                            RoundedRectangle(cornerRadius: 5).fill(.white).frame(width: 22, height: 22)
                                .overlay(Image(systemName: "photo.on.rectangle").font(.system(size: 9)).foregroundStyle(.orange))
                                .overlay(alignment: .topTrailing) {
                                    Circle().fill(.red).frame(width: 8, height: 8).offset(x: 3, y: -3)
                                }
                        } else {
                            RoundedRectangle(cornerRadius: 5).fill(colors[i].opacity(0.8)).frame(width: 22, height: 22)
                        }
                    }
                }
                .padding(.top, 40)
                Spacer()
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(LinearGradient(colors: [Color(hex: 0x3A2F7A), Color(hex: 0x0E4C6E)], startPoint: .top, endPoint: .bottom))
        }
    }
}

/// 1. The share sheet: FeatherShot Screenshot, then the Shortcuts app.
private struct ShareSheetScene: View {
    var body: some View {
        ZStack(alignment: .bottom) {
            Color(white: 0.06)
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    AppTile()
                    Text("FeatherShot Screenshot").font(.system(size: 8, weight: .semibold)).foregroundStyle(.white)
                        .lineLimit(1).minimumScaleFactor(0.5)
                }
                Divider().overlay(Color.white.opacity(0.15))
                HStack(spacing: 14) {
                    VStack(spacing: 4) {
                        ShortcutsGlyph()
                            .overlay(TapMarker())
                        Text("Shortcuts").font(.system(size: 8)).foregroundStyle(.white)
                    }
                    VStack(spacing: 4) {
                        RoundedRectangle(cornerRadius: 8).fill(.white).frame(width: 34, height: 34)
                            .overlay(Image(systemName: "ellipsis").font(.system(size: 12, weight: .bold)).foregroundStyle(.gray))
                        Text("More").font(.system(size: 8)).foregroundStyle(.white)
                    }
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 18).fill(Color(white: 0.2)))
            .padding(6)
        }
    }
}

/// 2. Shortcuts' import screen with Add Shortcut.
private struct ImportScene: View {
    var body: some View {
        VStack(spacing: 10) {
            Text("FeatherShot Screenshot")
                .font(.system(size: 11, weight: .bold))
                .lineLimit(1).minimumScaleFactor(0.7)
                .foregroundStyle(.black)
                .padding(.top, 34)
            Spacer()
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(LinearGradient(colors: [Color(hex: 0x2E9BFF), Color(hex: 0x1A7BFF)], startPoint: .top, endPoint: .bottom))
                .frame(width: 84, height: 56)
                .overlay(alignment: .bottomLeading) {
                    Text("FeatherShot\nScreenshot").font(.system(size: 7, weight: .semibold)).foregroundStyle(.white).padding(6)
                }
            Spacer()
            Capsule()
                .fill(Color(hex: 0x0A84FF))
                .frame(height: 28)
                .overlay(Text("Add Shortcut").font(.system(size: 9, weight: .semibold)).foregroundStyle(.white))
                .overlay(TapMarker())
                .padding(.horizontal, 12)
                .padding(.bottom, 14)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(white: 0.95))
    }
}

/// 3 (iPad). Control Center with the FeatherShot Screenshot control added.
private struct ControlCenterScene: View {
    var body: some View {
        let tiles: [(String, Color)] = [("airplane", .orange), ("wifi", .blue), ("antenna.radiowaves.left.and.right", .green),
                                        ("moon.fill", .indigo), ("flashlight.off.fill", .gray), ("timer", .gray)]
        VStack(spacing: 10) {
            Text("Control Center").font(.system(size: 10, weight: .semibold)).foregroundStyle(.white).padding(.top, 34)
            LazyVGrid(columns: Array(repeating: GridItem(.fixed(34), spacing: 10), count: 3), spacing: 10) {
                ForEach(tiles.indices, id: \.self) { i in
                    Circle().fill(Color.white.opacity(0.16)).frame(width: 34, height: 34)
                        .overlay(Image(systemName: tiles[i].0).font(.system(size: 13, weight: .semibold)).foregroundStyle(tiles[i].1))
                }
            }
            VStack(spacing: 4) {
                Circle().fill(Color.white).frame(width: 40, height: 40)
                    .overlay(Image("Logo").resizable().frame(width: 26, height: 26).clipShape(RoundedRectangle(cornerRadius: 6)))
                    .overlay(TapMarker())
                Text("FeatherShot Screenshot").font(.system(size: 7, weight: .semibold)).foregroundStyle(.white)
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(LinearGradient(colors: [Color(white: 0.18), Color(white: 0.08)], startPoint: .top, endPoint: .bottom))
    }
}

/// 3. Settings › Action Button, Shortcut page, FeatherShot Screenshot chosen.
private struct ActionButtonScene: View {
    var body: some View {
        VStack(spacing: 10) {
            Text("Action Button").font(.system(size: 10, weight: .semibold)).foregroundStyle(.white).padding(.top, 34)
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(LinearGradient(colors: [Color(white: 0.45), Color(white: 0.2)], startPoint: .top, endPoint: .bottom))
                .frame(width: 44, height: 80)
                .overlay(Image(systemName: "square.2.layers.3d").font(.system(size: 16)).foregroundStyle(.white.opacity(0.85)))
            Text("Shortcut").font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
            HStack(spacing: 6) {
                Text("FeatherShot Screenshot").font(.system(size: 8, weight: .semibold)).foregroundStyle(.white)
                    .lineLimit(1).minimumScaleFactor(0.7)
                Image(systemName: "checkmark").font(.system(size: 8, weight: .bold)).foregroundStyle(EditorTheme.link)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(Capsule().fill(Color.white.opacity(0.14)))
            .overlay(TapMarker())
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black)
    }
}

/// 4. Press the Action Button; the first time, allow sharing; FeatherShot opens.
private struct PressScene: View {
    var body: some View {
        ZStack(alignment: .topLeading) {
            Color(white: 0.92)
            VStack(spacing: 8) {
                Text("Allow “FeatherShot Screenshot” to share 1 image with “FeatherShot”?")
                    .font(.system(size: 8, weight: .semibold))
                    .foregroundStyle(.black)
                    .multilineTextAlignment(.center)
                Capsule().fill(Color(white: 0.85)).frame(height: 20)
                    .overlay(Text("Don’t Allow").font(.system(size: 8)).foregroundStyle(.black))
                Capsule().fill(Color(hex: 0x0A84FF)).frame(height: 20)
                    .overlay(Text("Always Allow").font(.system(size: 8, weight: .semibold)).foregroundStyle(.white))
                    .overlay(TapMarker())
            }
            .padding(10)
            .background(RoundedRectangle(cornerRadius: 14).fill(.white))
            .padding(.horizontal, 10)
            .frame(maxHeight: .infinity)

            // The Action Button on the left edge.
            Capsule().fill(Color.orange).frame(width: 5, height: 22).offset(x: -2, y: 64)
                .overlay(alignment: .leading) { TapMarker().scaleEffect(0.6).offset(x: -10, y: 64) }
        }
    }
}

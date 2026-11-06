import SwiftUI

struct ShotListView: View {
    let store: ShotStore
    @State private var path: [Shot] = []

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if store.shots.isEmpty {
                    EmptyShotsView()
                } else {
                    List {
                        ForEach(store.shots) { shot in
                            NavigationLink(value: shot) {
                                ShotRow(shot: shot)
                            }
                            .listRowInsets(EdgeInsets(top: 6, leading: 6, bottom: 6, trailing: 6))
                        }
                        .onDelete { offsets in
                            offsets.map { store.shots[$0] }.forEach(store.delete)
                        }
                    }
                    .listStyle(.carousel)
                }
            }
            .navigationTitle("FeatherShot")
            .navigationDestination(for: Shot.self) { ShotDetailView(shot: $0) }
        }
        .tint(Color(red: 0.0, green: 0.4, blue: 1.0))
        #if DEBUG
        // Debug-only, for the App Store screenshots: `--demo-detail` opens the newest screenshot.
        .onAppear {
            if CommandLine.arguments.contains("--demo-detail"), let first = store.shots.first { path = [first] }
        }
        #endif
    }
}

private struct ShotRow: View {
    let shot: Shot

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let image = UIImage(contentsOfFile: shot.url.path) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .frame(maxWidth: .infinity)
                    .accessibilityLabel("Annotated screenshot")
            }
            Text(shot.date, format: .relative(presentation: .named))
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}

private struct EmptyShotsView: View {
    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                Image("Logo")
                    .resizable()
                    .frame(width: 44, height: 44)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .accessibilityHidden(true)
                Text("No screenshots yet")
                    .font(.headline)
                Text("Annotate a screenshot on your iPhone and tap Save & Copy. It shows up here.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, 6)
        }
    }
}

/// One screenshot full screen. Turn the Digital Crown to zoom, drag to look around.
struct ShotDetailView: View {
    let shot: Shot
    @State private var zoom: Double = Self.initialZoom
    @State private var offset: CGSize = .zero
    @State private var dragStart: CGSize = .zero

    var body: some View {
        GeometryReader { geo in
            if let image = UIImage(contentsOfFile: shot.url.path) {
                // Full width at zoom 1; tall screenshots continue below, drag to see the rest.
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(width: geo.size.width)
                    .scaleEffect(zoom, anchor: .top)
                    .offset(offset)
                    .frame(width: geo.size.width, height: geo.size.height, alignment: .top)
                    .contentShape(Rectangle())
                    .gesture(
                        DragGesture()
                            .onChanged { value in
                                offset = CGSize(width: dragStart.width + value.translation.width,
                                                height: dragStart.height + value.translation.height)
                            }
                            .onEnded { _ in dragStart = offset }
                    )
                    .accessibilityLabel("Annotated screenshot")
            }
        }
        .ignoresSafeArea(edges: .bottom)
        .focusable()
        .digitalCrownRotation($zoom, from: 1, through: 4, by: 0.1, sensitivity: .low, isContinuous: false, isHapticFeedbackEnabled: true)
        .onChange(of: zoom) { _, newValue in
            if newValue <= 1.01 && offset.width != 0 { withAnimation { offset.width = 0; dragStart.width = 0 } }
        }
        .navigationTitle(Text(shot.date, style: .time))
        .navigationBarTitleDisplayMode(.inline)
    }

    /// 1, or `--demo-zoom <x>` in Debug builds (App Store screenshots).
    private static var initialZoom: Double {
        #if DEBUG
        let args = CommandLine.arguments
        if let i = args.firstIndex(of: "--demo-zoom"), i + 1 < args.count, let z = Double(args[i + 1]) { return z }
        #endif
        return 1
    }
}

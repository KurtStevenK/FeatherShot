// Renders the made-up "Lisbon Weekend" phone screen that the App Store screenshots annotate.
// Our own content: bright, so the annotations stand out, and nothing from other apps or sites.
//
//   swift packaging/ios/appstore/demo_screen.swift <out.png>
//
// Output: 1206×2622 px (402×874 pt at 3x), the size of an iPhone 18 Pro screenshot.
import AppKit
import SwiftUI

let size = CGSize(width: 402, height: 874)

struct StatusBar: View {
    var body: some View {
        HStack {
            Text("9:41").font(.system(size: 17, weight: .semibold))
            Spacer()
            HStack(spacing: 6) {
                Image(systemName: "cellularbars")
                Image(systemName: "wifi")
                Image(systemName: "battery.100")
            }
            .font(.system(size: 15, weight: .semibold))
        }
        .foregroundStyle(.black)
        .padding(.horizontal, 34)
        .frame(height: 54)
    }
}

struct Stop: View {
    let icon: String
    let tint: Color
    let title: String
    let detail: String
    let time: String

    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 11, style: .continuous)
                .fill(tint.gradient)
                .frame(width: 42, height: 42)
                .overlay(Image(systemName: icon).font(.system(size: 18, weight: .semibold)).foregroundStyle(.white))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.system(size: 16, weight: .semibold)).foregroundStyle(.black)
                Text(detail).font(.system(size: 13)).foregroundStyle(Color(white: 0.45))
            }
            Spacer()
            Text(time).font(.system(size: 15, weight: .semibold).monospacedDigit()).foregroundStyle(Color(white: 0.2))
        }
        .padding(.horizontal, 14)
        .frame(height: 62)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white))
        .shadow(color: .black.opacity(0.05), radius: 6, y: 2)
    }
}

struct MapCard: View {
    var body: some View {
        ZStack(alignment: .topLeading) {
            Color(red: 0.88, green: 0.94, blue: 0.86)
            // The river.
            Path { p in
                p.move(to: CGPoint(x: 0, y: 112)); p.addCurve(to: CGPoint(x: 370, y: 98), control1: CGPoint(x: 120, y: 88), control2: CGPoint(x: 240, y: 132))
                p.addLine(to: CGPoint(x: 370, y: 150)); p.addLine(to: CGPoint(x: 0, y: 150)); p.closeSubpath()
            }
            .fill(Color(red: 0.62, green: 0.80, blue: 0.95))
            // Streets.
            Path { p in
                for x in stride(from: 30.0, to: 370, by: 68) { p.move(to: CGPoint(x: x, y: 0)); p.addLine(to: CGPoint(x: x + 24, y: 100)) }
                for y in stride(from: 24.0, to: 100, by: 30) { p.move(to: CGPoint(x: 0, y: y)); p.addLine(to: CGPoint(x: 370, y: y + 8)) }
            }
            .stroke(.white, lineWidth: 4)
            // The route between the stops.
            Path { p in
                p.move(to: CGPoint(x: 52, y: 70)); p.addLine(to: CGPoint(x: 138, y: 40))
                p.addLine(to: CGPoint(x: 232, y: 64)); p.addLine(to: CGPoint(x: 318, y: 30))
            }
            .stroke(Color(red: 0.0, green: 0.48, blue: 1.0), style: StrokeStyle(lineWidth: 4, lineCap: .round, dash: [8, 6]))
            ForEach(Array([(52.0, 70.0, Color.orange), (138, 40, .yellow), (232, 64, .purple), (318, 30, .pink)].enumerated()), id: \.offset) { _, pin in
                Circle().fill(pin.2).frame(width: 18, height: 18)
                    .overlay(Circle().stroke(.white, lineWidth: 3))
                    .position(x: pin.0, y: pin.1)
            }
        }
        .frame(height: 150)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

struct DemoScreen: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            StatusBar()
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Lisbon Weekend").font(.system(size: 32, weight: .bold)).foregroundStyle(.black)
                    Text("Fri 14 – Sun 16 Nov · 3 days").font(.system(size: 15)).foregroundStyle(Color(white: 0.45))
                }
                ZStack(alignment: .bottomLeading) {
                    LinearGradient(colors: [Color(red: 1.0, green: 0.62, blue: 0.25), Color(red: 0.96, green: 0.30, blue: 0.48)],
                                   startPoint: .topLeading, endPoint: .bottomTrailing)
                    Image(systemName: "tram.fill")
                        .font(.system(size: 120))
                        .foregroundStyle(.white.opacity(0.18))
                        .offset(x: 220, y: -18)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("TODAY").font(.system(size: 12, weight: .bold)).foregroundStyle(.white.opacity(0.85))
                        Text("Tram 28 Tour").font(.system(size: 26, weight: .bold)).foregroundStyle(.white)
                        Text("10:30 · Graça → Estrela").font(.system(size: 14, weight: .medium)).foregroundStyle(.white.opacity(0.9))
                    }
                    .padding(18)
                    Text("☀︎ 22°")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .background(Capsule().fill(.white.opacity(0.25)))
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                        .padding(14)
                }
                .frame(height: 160)
                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))

                HStack {
                    Text("Itinerary").font(.system(size: 20, weight: .bold)).foregroundStyle(.black)
                    Spacer()
                    Text("4 stops").font(.system(size: 14)).foregroundStyle(Color(white: 0.45))
                }
                .padding(.top, 4)
                VStack(spacing: 10) {
                    Stop(icon: "cup.and.saucer.fill", tint: .orange, title: "Pastéis de Belém", detail: "Breakfast · Belém", time: "09:00")
                    Stop(icon: "tram.fill", tint: Color(red: 0.95, green: 0.75, blue: 0.1), title: "Tram 28", detail: "Sightseeing · Alfama", time: "10:30")
                    Stop(icon: "bag.fill", tint: .purple, title: "LX Factory", detail: "Shopping · Alcântara", time: "14:00")
                    Stop(icon: "sun.horizon.fill", tint: .pink, title: "Miradouro", detail: "Sunset · Graça", time: "18:30")
                }
                MapCard()
                Capsule()
                    .fill(Color(red: 0.0, green: 0.48, blue: 1.0))
                    .frame(height: 50)
                    .overlay(Label("Share Itinerary", systemImage: "square.and.arrow.up")
                        .font(.system(size: 17, weight: .semibold)).foregroundStyle(.white))
            }
            .padding(.horizontal, 18)
            .padding(.top, 6)
            Spacer(minLength: 0)
        }
        .frame(width: size.width, height: size.height, alignment: .top)
        .background(Color(red: 0.96, green: 0.96, blue: 0.98))
        .environment(\.colorScheme, .light)
    }
}

MainActor.assumeIsolated {
    let renderer = ImageRenderer(content: DemoScreen())
    renderer.scale = 3
    guard let cg = renderer.cgImage else { fatalError("render failed") }
    let rep = NSBitmapImageRep(cgImage: cg)
    let png = rep.representation(using: .png, properties: [:])!
    try! png.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
    print("\(cg.width)x\(cg.height)")
}

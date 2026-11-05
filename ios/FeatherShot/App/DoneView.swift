import SwiftUI

/// After Save & Copy. An iPhone app cannot close itself, so this says where the image went.
struct DoneView: View {
    let model: AppModel

    var body: some View {
        VStack(spacing: 18) {
            Spacer()
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 64))
                .foregroundStyle(EditorTheme.success)
                .accessibilityHidden(true)
            Text("Saved & Copied")
                .font(.title2.weight(.bold))
                .foregroundStyle(EditorTheme.text)
            Text("The screenshot is in Photos and on the clipboard. Swipe up to go back and paste it.")
                .font(.subheadline)
                .foregroundStyle(EditorTheme.muted)
                .multilineTextAlignment(.center)
            Spacer()
            OpenFromPhotosButton(model: model, title: "Annotate Another", kind: .ghost)
            Button { model.cancel() } label: {
                Text("Done").frame(maxWidth: .infinity)
            }
            .buttonStyle(EditorPillButtonStyle(kind: .primary))
        }
        .padding(24)
        .frame(maxWidth: 480)
    }
}

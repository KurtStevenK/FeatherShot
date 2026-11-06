import UIKit

@MainActor
enum Device {
    /// iPad has no Action Button: setup texts point to Control Center instead.
    static var isPad: Bool { UIDevice.current.userInterfaceIdiom == .pad }
}

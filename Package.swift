// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "FeatherShot",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "FeatherShot", targets: ["FeatherShot"]),
    ],
    targets: [
        .executableTarget(
            name: "FeatherShot",
            path: "Sources",
            linkerSettings: [
                .unsafeFlags(["-Xlinker", "-sectcreate", "-Xlinker", "__TEXT", "-Xlinker", "__info_plist", "-Xlinker", "Info.plist"])
            ]
        )
    ]
)

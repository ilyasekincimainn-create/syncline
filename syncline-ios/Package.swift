// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "SyncLine",
    defaultLocalization: "tr",
    platforms: [
        .iOS(.v16)
    ],
    products: [
        .library(
            name: "SyncLine",
            targets: ["SyncLine"]
        )
    ],
    dependencies: [
        // WebRTC iOS library distribution
        .package(url: "https://github.com/stasel/WebRTC.git", from: "115.0.0")
    ],
    targets: [
        .target(
            name: "SyncLine",
            dependencies: [
                .product(name: "WebRTC", package: "WebRTC")
            ],
            path: "SyncLine"
        )
    ]
)

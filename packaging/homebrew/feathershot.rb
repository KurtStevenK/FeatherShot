# Rendered by CI: __VERSION__ and __SHA__ replaced with release version and DMG SHA-256.
cask "feathershot" do
  version "__VERSION__"
  sha256 "__SHA__"

  url "https://github.com/KurtStevenK/FeatherShot/releases/download/v#{version}/FeatherShot-#{version}-(macOS).dmg"
  name "FeatherShot"
  desc "Lightweight screenshot annotations"
  homepage "https://github.com/KurtStevenK/FeatherShot"

  app "FeatherShot.app"
end

# Rendered by CI: __VERSION__, __SHA__, __DMG_FILENAME__ (GitHub renames "(macOS)" → ".macOS" on upload).
cask "feathershot" do
  version "__VERSION__"
  sha256 "__SHA__"

  url "https://github.com/KurtStevenK/FeatherShot/releases/download/v#{version}/__DMG_FILENAME__"
  name "FeatherShot"
  desc "Lightweight screenshot annotations"
  homepage "https://github.com/KurtStevenK/FeatherShot"

  app "FeatherShot.app"
end

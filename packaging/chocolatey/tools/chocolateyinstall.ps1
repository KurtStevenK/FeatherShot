# Rendered by CI: __VERSION__ -> release version, __EXESHA__ -> SHA-256 of the x64 NSIS installer.
$ErrorActionPreference = 'Stop'

$packageArgs = @{
    packageName    = $env:ChocolateyPackageName
    fileType       = 'exe'
    url            = 'https://github.com/KurtStevenK/FeatherShot/releases/download/v__VERSION__/FeatherShot-Setup-__VERSION__-%28Windows%29.exe'
    checksum       = '__EXESHA__'
    checksumType   = 'sha256'
    silentArgs     = '/S'
    validExitCodes = @(0)
}

Install-ChocolateyPackage @packageArgs

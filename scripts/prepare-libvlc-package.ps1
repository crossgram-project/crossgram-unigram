param (
  [Parameter(Mandatory = $true)]
  [string]$Source,
  [string]$Version = "3.3.2"
)

$ErrorActionPreference = "Stop"
$sourceRoot = (Resolve-Path $Source).Path
$targetsPath = Join-Path $sourceRoot "packages\VideoLAN.LibVLC.UWP.$Version\build\VideoLAN.LibVLC.UWP.targets"

if (-not (Test-Path -LiteralPath $targetsPath -PathType Leaf)) {
  throw "LibVLC UWP targets were not restored: $targetsPath"
}

$targets = [System.IO.File]::ReadAllText($targetsPath)
$legacyReference = 'Microsoft.VCLibs.120, Version=14.0'
$currentReference = 'Microsoft.VCLibs, Version=14.0'
if (-not $targets.Contains($legacyReference) -and -not $targets.Contains($currentReference)) {
  throw "LibVLC UWP targets do not contain a recognized Visual C++ runtime SDK reference"
}

$targets = $targets.Replace($legacyReference, $currentReference)
$targets = $targets.Replace(
  "Microsoft Visual C++ 2013 Runtime Package for Windows Universal",
  "Microsoft Visual C++ Runtime Package for Windows Universal"
)
[System.IO.File]::WriteAllText($targetsPath, $targets, [System.Text.UTF8Encoding]::new($false))

Write-Output "Prepared LibVLC UWP package targets at $targetsPath"

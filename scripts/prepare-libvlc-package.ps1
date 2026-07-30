param (
  [Parameter(Mandatory = $true)]
  [string]$Source,
  [string]$Version = "3.3.2",
  [switch]$RequireGlobalPackage
)

$ErrorActionPreference = "Stop"
$sourceRoot = (Resolve-Path $Source).Path
$targetsPath = Join-Path $sourceRoot "packages\VideoLAN.LibVLC.UWP.$Version\build\VideoLAN.LibVLC.UWP.targets"
$mediaHeaderPath = Join-Path $sourceRoot "packages\VideoLAN.LibVLC.UWP.$Version\build\win10-x64\sdk\include\vlc\libvlc_media.h"

if (-not (Test-Path -LiteralPath $targetsPath -PathType Leaf)) {
  throw "LibVLC UWP targets were not restored: $targetsPath"
}
if (-not (Test-Path -LiteralPath $mediaHeaderPath -PathType Leaf)) {
  throw "LibVLC UWP media header was not restored: $mediaHeaderPath"
}

$legacyReference = 'Microsoft.VCLibs.120, Version=14.0'
$currentReference = 'Microsoft.VCLibs, Version=14.0'

function Normalize-LibVlcTargets([string]$Path) {
  $targets = [System.IO.File]::ReadAllText($Path)
  if (-not $targets.Contains($legacyReference) -and -not $targets.Contains($currentReference)) {
    throw "LibVLC UWP targets do not contain a recognized Visual C++ runtime SDK reference: $Path"
  }

  $targets = $targets.Replace($legacyReference, $currentReference)
  $targets = $targets.Replace(
    "Microsoft Visual C++ 2013 Runtime Package for Windows Universal",
    "Microsoft Visual C++ Runtime Package for Windows Universal"
  )
  [System.IO.File]::WriteAllText($Path, $targets, [System.Text.UTF8Encoding]::new($false))
}

Normalize-LibVlcTargets $targetsPath

$globalPackagesRoot = if ($env:NUGET_PACKAGES) {
  $env:NUGET_PACKAGES
} else {
  $profileRoot = if ($env:USERPROFILE) { $env:USERPROFILE } else { $env:HOME }
  if (-not $profileRoot) {
    throw "Cannot locate the NuGet global packages directory"
  }
  Join-Path $profileRoot ".nuget\packages"
}
$globalTargetsPath = Join-Path $globalPackagesRoot "videolan.libvlc.uwp\$Version\build\VideoLAN.LibVLC.UWP.targets"
if (Test-Path -LiteralPath $globalTargetsPath -PathType Leaf) {
  Normalize-LibVlcTargets $globalTargetsPath
} elseif ($RequireGlobalPackage) {
  throw "LibVLC UWP global package targets were not restored: $globalTargetsPath"
}

$mediaHeader = [System.IO.File]::ReadAllText($mediaHeaderPath)
$ssizeCompatibility = @'
#if defined(_MSC_VER) && !defined(_SSIZE_T_DEFINED)
#include <BaseTsd.h>
typedef SSIZE_T ssize_t;
#define _SSIZE_T_DEFINED
#endif
'@
if (-not $mediaHeader.Contains('_SSIZE_T_DEFINED')) {
  $headerAnchor = '# ifdef __cplusplus'
  if (-not $mediaHeader.Contains($headerAnchor)) {
    throw "LibVLC UWP media header does not contain the expected C++ compatibility anchor"
  }
  $mediaHeader = $mediaHeader.Replace($headerAnchor, "$ssizeCompatibility`r`n`r`n$headerAnchor")
  [System.IO.File]::WriteAllText($mediaHeaderPath, $mediaHeader, [System.Text.UTF8Encoding]::new($false))
}

Write-Output "Prepared LibVLC UWP package targets and media header"

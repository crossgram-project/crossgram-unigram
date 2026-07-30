param (
  [Parameter(Mandatory = $true)]
  [string]$Source,
  [Parameter(Mandatory = $true)]
  [int]$ApiId,
  [Parameter(Mandatory = $true)]
  [string]$ApiHash
)

$ErrorActionPreference = "Stop"
$sourceRoot = (Resolve-Path $Source).Path

if ($ApiId -le 0) {
  throw "ApiId must be a positive integer"
}
if ($ApiHash -notmatch '^[0-9a-fA-F]{32}$') {
  throw "ApiHash must contain exactly 32 hexadecimal characters"
}

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

$secretPath = Join-Path $sourceRoot "Telegram\Constants.Secret.cs"
$secret = @"
namespace Telegram
{
    public static partial class Constants
    {
        static Constants()
        {
            ApiId = $ApiId;
            ApiHash = "$($ApiHash.ToLowerInvariant())";
            AppChannel = "crossgram-unigram";
            AppReportsId = string.Empty;
            AppCenterId = string.Empty;
            BuildNumber = 1;
            TextRecognizerModelKey = string.Empty;
        }
    }
}
"@
Write-Utf8NoBom $secretPath $secret

# The public Unigram source expects a private WebRTC tree at C:\webrtc. Calls
# are isolated behind ENABLE_CALLS, so release builds omit that optional native
# component while retaining messaging, media playback, and Crossgram downloads.
$telegramProjectPath = Join-Path $sourceRoot "Telegram\Telegram.csproj"
$telegramProject = [System.IO.File]::ReadAllText($telegramProjectPath)
$telegramProject = $telegramProject.Replace(";ENABLE_CALLS", "").Replace("ENABLE_CALLS;", "")
$telegramProject = [regex]::Replace(
  $telegramProject,
  '(?s)\s*<ProjectReference Include="\.\.\\Telegram\.Native\.Calls\\Telegram\.Native\.Calls\.vcxproj">.*?</ProjectReference>',
  ""
)
Write-Utf8NoBom $telegramProjectPath $telegramProject

# Give the sideload package a distinct identity. Keep the publisher subject of
# the checked-in temporary certificate so Windows can verify the signature.
$updateManifestPath = Join-Path $sourceRoot "UpdateManifest.ps1"
$updateManifest = [System.IO.File]::ReadAllText($updateManifestPath)
$updateManifest = [regex]::Replace(
  $updateManifest,
  'Name = "(?:38833FF26BA1D\.UnigramExperimental|38833FF26BA1D\.UnigramPreview|TelegramFZ-LLC\.Windows)";',
  'Name = "CrossgramProject.CrossgramUnigram";'
)
$updateManifest = [regex]::Replace(
  $updateManifest,
  'Publisher = (?:"CN=D89C87B4-2758-402A-8F40-3571D00882AB"|''CN=Telegram FZ-LLC[^'']*'');',
  'Publisher = "CN=D89C87B4-2758-402A-8F40-3571D00882AB";'
)
$updateManifest = [regex]::Replace(
  $updateManifest,
  'DisplayName = (?:"Unigram Experimental"|\("Unigram\{0\}Telegram for Windows" -f \[char\]0x2014\));',
  'DisplayName = "Crossgram Unigram";'
)
$updateManifest = [regex]::Replace(
  $updateManifest,
  'PublisherDisplayName = (?:"Unigram, Inc\."|"Telegram FZ-LLC");',
  'PublisherDisplayName = "Crossgram Project";'
)
$updateManifest = $updateManifest.Replace('AppName = "Telegram"', 'AppName = "Crossgram Unigram"')
$updateManifest = $updateManifest.Replace('AppName = "Unigram"', 'AppName = "Crossgram Unigram"')
Write-Utf8NoBom $updateManifestPath $updateManifest

Write-Output "Prepared Crossgram Unigram release source at $sourceRoot"

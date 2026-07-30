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
$nativeCallsCompile = '    <Compile Include="NativeCallsStub.cs" />'
if (-not $telegramProject.Contains($nativeCallsCompile)) {
  $stubCompile = '    <Compile Include="Stub.cs" />'
  if (-not $telegramProject.Contains($stubCompile)) {
    throw "Telegram.csproj does not contain the Stub.cs compile anchor"
  }
  $telegramProject = $telegramProject.Replace(
    $stubCompile,
    "$stubCompile`r`n$nativeCallsCompile"
  )
}
Write-Utf8NoBom $telegramProjectPath $telegramProject

# The public repository omits the private WebRTC tree used by
# Telegram.Native.Calls. Calls are disabled above, but several shared source
# files still reference the projected WinRT types at compile time. Provide a
# no-op compatibility surface so the public-source sideload build remains
# self-contained without pretending to implement voice/video calls.
$nativeCallsStubPath = Join-Path $sourceRoot "Telegram\NativeCallsStub.cs"
$nativeCallsStub = @'
using System;
using System.Collections.Generic;
using Windows.Foundation;
using Windows.Graphics.Capture;
using Windows.UI.Composition;

namespace Telegram.Native.Calls
{
    public enum VoipReadyState { WaitInit, WaitInitAck, Established, Failed, Reconnecting }
    public enum VoipAudioState { Muted, Active }
    public enum VoipVideoState { Inactive, Paused, Active }
    public enum VoipGroupConnectionMode { None, Rtc, Broadcast }
    public enum VoipVideoContentType { None, Screencast, Generic }
    public enum VoipVideoChannelQuality { Thumbnail, Medium, Full }
    public enum VoipDataChannel { Main, ScreenSharing }

    public struct VoipGroupParticipant
    {
        public int AudioSource;
        public float Level;
        public bool IsSpeaking;
        public bool IsMuted;
    }

    public struct VoipMediaChannelDescription
    {
        public int AudioSource;
        public long UserId;
    }

    public delegate void BroadcastPartRequestedDeferral(long time, long response, IList<byte> data);
    public delegate void BroadcastTimeRequestedDeferral(long time);
    public delegate void MediaChannelDescriptionsRequestedDeferral(IList<VoipMediaChannelDescription> participants);
    public delegate void EmitJsonPayloadDelegate(int ssrc, string payload);
    public delegate IList<byte> EncryptGroupCallDataDelegate(
        VoipDataChannel dataChannel, IList<byte> data, int unencryptedPrefixSize);
    public delegate IList<byte> DecryptGroupCallDataDelegate(long userId, IList<byte> data);

    public sealed class AudioBroadcastPartRequestedEventArgs
    {
        public int Scale { get; set; }
        public long Time { get; set; }
        public BroadcastPartRequestedDeferral Deferral { get; set; }
    }

    public sealed class VideoBroadcastPartRequestedEventArgs
    {
        public int Scale { get; set; }
        public long Time { get; set; }
        public int ChannelId { get; set; }
        public VoipVideoChannelQuality VideoQuality { get; set; }
        public BroadcastPartRequestedDeferral Deferral { get; set; }
    }

    public sealed class BroadcastTimeRequestedEventArgs
    {
        public BroadcastTimeRequestedDeferral Deferral { get; set; }
    }

    public sealed class FrameReceivedEventArgs
    {
        public int PixelWidth { get; set; }
        public int PixelHeight { get; set; }
    }

    public sealed class GroupNetworkStateChangedEventArgs
    {
        public bool IsConnected { get; set; }
        public bool IsTransitioningFromBroadcastToRtc { get; set; }
    }

    public sealed class MediaChannelDescriptionsRequestedEventArgs
    {
        public IList<uint> AudioSourceIds { get; set; } = new List<uint>();
        public MediaChannelDescriptionsRequestedDeferral Deferral { get; set; }
    }

    public sealed class RemoteMediaStateUpdatedEventArgs
    {
        public VoipAudioState Audio { get; set; }
        public VoipVideoState Video { get; set; }
    }

    public sealed class SignalingDataEmittedEventArgs
    {
        public IList<byte> Data { get; set; } = new List<byte>();
    }

    public sealed class VoipCallProtocol
    {
        public VoipCallProtocol(bool udpP2p, bool udpReflector, int minLayer, int maxLayer,
            IList<string> libraryVersions)
        {
            UdpP2p = udpP2p;
            UdpReflector = udpReflector;
            MinLayer = minLayer;
            MaxLayer = maxLayer;
            LibraryVersions = libraryVersions;
        }

        public bool UdpP2p { get; }
        public bool UdpReflector { get; }
        public int MinLayer { get; }
        public int MaxLayer { get; }
        public IList<string> LibraryVersions { get; }
    }

    public interface VoipCallServerType { }

    public sealed class VoipCallServerTypeTelegramReflector : VoipCallServerType
    {
        public VoipCallServerTypeTelegramReflector(string peerTag, bool isTcp)
        {
            PeerTag = peerTag;
            IsTcp = isTcp;
        }

        public string PeerTag { get; }
        public bool IsTcp { get; }
    }

    public sealed class VoipCallServerTypeWebrtc : VoipCallServerType
    {
        public VoipCallServerTypeWebrtc(string username, string password, bool supportsTurn, bool supportsStun)
        {
            Username = username;
            Password = password;
            SupportsTurn = supportsTurn;
            SupportsStun = supportsStun;
        }

        public string Username { get; }
        public string Password { get; }
        public bool SupportsTurn { get; }
        public bool SupportsStun { get; }
    }

    public sealed class VoipCallServer
    {
        public VoipCallServer(long id, string ipAddress, string ipv6Address, int port, VoipCallServerType type)
        {
            Id = id;
            IpAddress = ipAddress;
            Ipv6Address = ipv6Address;
            Port = port;
            Type = type;
        }

        public long Id { get; }
        public string IpAddress { get; }
        public string Ipv6Address { get; }
        public int Port { get; }
        public VoipCallServerType Type { get; }
    }

    public class VoipCaptureBase
    {
        public event TypedEventHandler<VoipCaptureBase, object> FatalErrorOccurred;
        public void SetState(VoipVideoState state) { }
        public void SetOutput(VoipVideoOutputSink sink) { }
        public void Stop() { }
    }

    public sealed class VoipVideoCapture : VoipCaptureBase
    {
        public VoipVideoCapture(string id) { }
        public void SwitchToDevice(string deviceId) { }
        public void SetPreferredAspectRatio(float aspectRatio) { }
    }

    public sealed class VoipScreenCapture : VoipCaptureBase
    {
        public VoipScreenCapture(GraphicsCaptureItem item) { }
        public event TypedEventHandler<VoipScreenCapture, bool> Paused;
        public static bool IsSupported() => false;
    }

    public sealed class VoipVideoSourceGroup
    {
        public VoipVideoSourceGroup(string semantics, IList<int> sourceIds)
        {
            Semantics = semantics;
            SourceIds = sourceIds;
        }

        public string Semantics { get; set; }
        public IList<int> SourceIds { get; set; }
    }

    public sealed class VoipVideoChannelInfo
    {
        public VoipVideoChannelInfo(int audioSource, long participantId, string endpointId,
            IList<VoipVideoSourceGroup> sourceGroups, VoipVideoChannelQuality minQuality,
            VoipVideoChannelQuality maxQuality)
        {
            AudioSource = audioSource;
            ParticipantId = participantId;
            EndpointId = endpointId;
            SourceGroups = sourceGroups;
            MinQuality = minQuality;
            MaxQuality = maxQuality;
        }

        public int AudioSource { get; }
        public long ParticipantId { get; }
        public string EndpointId { get; }
        public IList<VoipVideoSourceGroup> SourceGroups { get; }
        public VoipVideoChannelQuality MinQuality { get; }
        public VoipVideoChannelQuality MaxQuality { get; }
    }

    public sealed class VoipVideoOutputSink
    {
        public VoipVideoOutputSink(CompositionGraphicsDevice device, SpriteVisual visual,
            bool mirrored, bool uniformToFill)
        {
            IsMirrored = mirrored;
        }

        public event TypedEventHandler<VoipVideoOutputSink, FrameReceivedEventArgs> FrameReceived;
        public bool IsMirrored { get; set; }
        public int PixelWidth { get; set; }
        public int PixelHeight { get; set; }
        public void Stop() { }
    }

    public sealed class VoipDescriptor
    {
        public string Version { get; set; }
        public string CustomParameters { get; set; }
        public double InitializationTimeout { get; set; }
        public double ReceiveTimeout { get; set; }
        public IList<byte> PersistentState { get; set; } = new List<byte>();
        public IList<VoipCallServer> Servers { get; set; } = new List<VoipCallServer>();
        public IList<byte> EncryptionKey { get; set; } = new List<byte>();
        public bool IsOutgoing { get; set; }
        public bool EnableP2p { get; set; }
        public string AudioInputId { get; set; }
        public string AudioOutputId { get; set; }
        public VoipCaptureBase VideoCapture { get; set; }
    }

    public sealed class VoipGroupDescriptor
    {
        public string AudioInputId { get; set; }
        public string AudioOutputId { get; set; }
        public VoipVideoContentType VideoContentType { get; set; }
        public VoipCaptureBase VideoCapture { get; set; }
        public bool IsConference { get; set; }
        public bool IsNoiseSuppressionEnabled { get; set; }
        public long AudioProcessId { get; set; }
    }

    public sealed class VoipGroupManager
    {
        public VoipGroupManager(VoipGroupDescriptor descriptor) { }
        public event TypedEventHandler<VoipGroupManager, GroupNetworkStateChangedEventArgs> NetworkStateUpdated;
        public event TypedEventHandler<VoipGroupManager, IList<VoipGroupParticipant>> AudioLevelsUpdated;
        public event TypedEventHandler<VoipGroupManager, BroadcastTimeRequestedEventArgs> BroadcastTimeRequested;
        public event TypedEventHandler<VoipGroupManager, AudioBroadcastPartRequestedEventArgs> AudioBroadcastPartRequested;
        public event TypedEventHandler<VoipGroupManager, VideoBroadcastPartRequestedEventArgs> VideoBroadcastPartRequested;
        public event TypedEventHandler<VoipGroupManager, MediaChannelDescriptionsRequestedEventArgs> MediaChannelDescriptionsRequested;
        public bool IsMuted { get; set; }
        public bool IsNoiseSuppressionEnabled { get; set; }
        public void Stop() { }
        public void SetConnectionMode(VoipGroupConnectionMode mode, bool keepBroadcastIfWasEnabled,
            bool isUnifiedBroadcast) { }
        public void EmitJoinPayload(EmitJsonPayloadDelegate completion) { }
        public void SetJoinResponsePayload(string payload) { }
        public void RemoveSsrcs(IList<int> ssrcs) { }
        public void AddIncomingVideoOutput(string endpointId, VoipVideoOutputSink sink) { }
        public void SetAudioOutputDevice(string id) { }
        public void SetAudioInputDevice(string id) { }
        public void SetVideoCapture(VoipCaptureBase videoCapture) { }
        public void SetVolume(int ssrc, double volume) { }
        public void SetRequestedVideoChannels(IList<VoipVideoChannelInfo> descriptions) { }
        public void SetEncryptDecrypt(EncryptGroupCallDataDelegate encryptData,
            DecryptGroupCallDataDelegate decryptData) { }
    }

    public sealed class VoipManager
    {
        public static VoipCallProtocol Protocol { get; } =
            new VoipCallProtocol(false, false, 0, 0, new List<string>());
        public event TypedEventHandler<VoipManager, VoipReadyState> StateUpdated;
        public event TypedEventHandler<VoipManager, int> SignalBarsUpdated;
        public event TypedEventHandler<VoipManager, float> AudioLevelUpdated;
        public event TypedEventHandler<VoipManager, bool> RemoteBatteryLevelIsLowUpdated;
        public event TypedEventHandler<VoipManager, RemoteMediaStateUpdatedEventArgs> RemoteMediaStateUpdated;
        public event TypedEventHandler<VoipManager, float> RemotePrefferedAspectRatioUpdated;
        public event TypedEventHandler<VoipManager, SignalingDataEmittedEventArgs> SignalingDataEmitted;
        public bool IsMuted { get; set; }
        public bool SupportsVideo => false;
        public void Start(VoipDescriptor descriptor) { }
        public void Stop() { }
        public void SetAudioOutputGainControlEnabled(bool enabled) { }
        public void SetEchoCancellationStrength(int strength) { }
        public void SetIncomingVideoOutput(VoipVideoOutputSink sink) { }
        public void SetAudioInputDevice(string id) { }
        public void SetAudioOutputDevice(string id) { }
        public void SetAudioOutputDuckingEnabled(bool enabled) { }
        public void SetIsLowBatteryLevel(bool isLowBatteryLevel) { }
        public string GetDebugInfo() => string.Empty;
        public long GetPreferredRelayId() => 0;
        public void ReceiveSignalingData(IList<byte> data) { }
        public void SetVideoCapture(VoipCaptureBase videoCapture) { }
        public void SetRequestedVideoAspect(float aspect) { }
    }
}
'@
Write-Utf8NoBom $nativeCallsStubPath $nativeCallsStub

$messageDelegatePath = Join-Path $sourceRoot "Telegram\ViewModels\MessageDelegate.cs"
$messageDelegate = [System.IO.File]::ReadAllText($messageDelegatePath)
if (-not $messageDelegate.Contains("using System.Threading.Tasks;")) {
  $messageDelegate = $messageDelegate.Replace(
    "using System.Linq;",
    "using System.Linq;`r`nusing System.Threading.Tasks;"
  )
}
Write-Utf8NoBom $messageDelegatePath $messageDelegate

# Unigram v12.8 pins a prerelease LibVLC UWP package that has been removed
# from NuGet. The current package keeps the runtime-copy targets, but no longer
# ships the native .props file that used to configure the C++ compiler/linker.
# Upgrade both managed and native references and add the x64 native settings
# explicitly so the sideload build retains ordinary media playback.
$libVlcVersion = "3.3.2"
$nativePackagesPath = Join-Path $sourceRoot "Telegram.Native\packages.config"
$nativePackages = [System.IO.File]::ReadAllText($nativePackagesPath)
$nativePackages = $nativePackages.Replace('VideoLAN.LibVLC.UWP" version="3.0.22-rc1"', "VideoLAN.LibVLC.UWP`" version=`"$libVlcVersion`"")
Write-Utf8NoBom $nativePackagesPath $nativePackages

$nativeProjectPath = Join-Path $sourceRoot "Telegram.Native\Telegram.Native.vcxproj"
$nativeProject = [System.IO.File]::ReadAllText($nativeProjectPath)
$nativeProject = $nativeProject.Replace("VideoLAN.LibVLC.UWP.3.0.22-rc1", "VideoLAN.LibVLC.UWP.$libVlcVersion")
$nativeProject = [regex]::Replace(
  $nativeProject,
  '(?m)^\s*<Import Project="[^\r\n]*VideoLAN\.LibVLC\.UWP\.props"[^\r\n]*/>\r?\n?',
  ""
)
$nativeProject = [regex]::Replace(
  $nativeProject,
  '(?m)^\s*<Error Condition="[^\r\n]*VideoLAN\.LibVLC\.UWP\.props[^\r\n]*/>\r?\n?',
  ""
)
$libVlcNativeSettings = @"
  <ItemDefinitionGroup Condition="'`$(Configuration)|`$(Platform)'=='Release|x64'">
    <ClCompile>
      <AdditionalIncludeDirectories>..\packages\VideoLAN.LibVLC.UWP.$libVlcVersion\build\win10-x64\sdk\include;%(AdditionalIncludeDirectories)</AdditionalIncludeDirectories>
    </ClCompile>
    <Link>
      <AdditionalLibraryDirectories>..\packages\VideoLAN.LibVLC.UWP.$libVlcVersion\build\win10-x64\sdk\lib;%(AdditionalLibraryDirectories)</AdditionalLibraryDirectories>
      <AdditionalDependencies>libvlc.lib;libvlccore.lib;%(AdditionalDependencies)</AdditionalDependencies>
    </Link>
  </ItemDefinitionGroup>
"@
$nativeProject = $nativeProject.Replace(
  '  <Import Project="$(VCTargetsPath)\Microsoft.Cpp.targets" />',
  "$libVlcNativeSettings  <Import Project=`"`$(VCTargetsPath)\Microsoft.Cpp.targets`" />"
)
Write-Utf8NoBom $nativeProjectPath $nativeProject

$telegramProject = [System.IO.File]::ReadAllText($telegramProjectPath)
$telegramProject = [regex]::Replace(
  $telegramProject,
  '(<PackageReference Include="VideoLAN\.LibVLC\.UWP">\s*<Version>)[^<]+(</Version>)',
  "`${1}$libVlcVersion`${2}"
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

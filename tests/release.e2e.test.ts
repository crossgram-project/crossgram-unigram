import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("release source preparation", () => {
  let root = "";

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
    root = "";
  });

  it("writes credentials, removes private calls, and rewrites every package mode", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "crossgram-unigram-release-"));
    await mkdir(path.join(root, "Telegram"), { recursive: true });
    await mkdir(path.join(root, "Telegram", "ViewModels"), { recursive: true });
    await mkdir(path.join(root, "Telegram.Native"), { recursive: true });
    await mkdir(
      path.join(
        root,
        "packages",
        "VideoLAN.LibVLC.UWP.3.3.2",
        "build",
        "win10-x64",
        "sdk",
        "include",
        "vlc",
      ),
      { recursive: true },
    );
    await writeFile(
      path.join(root, "Telegram", "Telegram.csproj"),
      `<Project>
  <PropertyGroup><DefineConstants>TRACE;ENABLE_CALLS;CODE_ANALYSIS</DefineConstants></PropertyGroup>
  <ItemGroup>
    <Compile Include="Stub.cs" />
    <ProjectReference Include="..\\Telegram.Native.Calls\\Telegram.Native.Calls.vcxproj">
      <Project>{FDD3C45D-4CFF-4A90-8FEF-16CA70AB00BE}</Project>
    </ProjectReference>
    <PackageReference Include="VideoLAN.LibVLC.UWP">
      <Version>3.0.22-rc1</Version>
    </PackageReference>
  </ItemGroup>
</Project>`,
      "utf8",
    );
    await writeFile(
      path.join(root, "Telegram", "ViewModels", "MessageDelegate.cs"),
      `using System;
using System.Linq;
namespace Telegram.ViewModels { public sealed class MessageDelegate { } }`,
      "utf8",
    );
    await writeFile(
      path.join(
        root,
        "packages",
        "VideoLAN.LibVLC.UWP.3.3.2",
        "build",
        "win10-x64",
        "sdk",
        "include",
        "vlc",
        "libvlc_media.h",
      ),
      `#ifndef VLC_LIBVLC_MEDIA_H
#define VLC_LIBVLC_MEDIA_H 1
# ifdef __cplusplus
extern "C" {
# endif
typedef ssize_t (*libvlc_media_read_cb)(void *opaque, unsigned char *buf, size_t len);
#endif`,
      "utf8",
    );
    await writeFile(
      path.join(root, "Telegram.Native", "packages.config"),
      `<?xml version="1.0" encoding="utf-8"?>
<packages>
  <package id="VideoLAN.LibVLC.UWP" version="3.0.22-rc1" targetFramework="native" />
</packages>`,
      "utf8",
    );
    await writeFile(
      path.join(root, "Telegram.Native", "Telegram.Native.vcxproj"),
      `<Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
  <Import Project="..\\packages\\VideoLAN.LibVLC.UWP.3.0.22-rc1\\build\\native\\VideoLAN.LibVLC.UWP.props" Condition="Exists('old-props')" />
  <Import Project="$(VCTargetsPath)\\Microsoft.Cpp.targets" />
  <ImportGroup Label="ExtensionTargets">
    <Import Project="..\\packages\\VideoLAN.LibVLC.UWP.3.0.22-rc1\\build\\VideoLAN.LibVLC.UWP.targets" Condition="Exists('new-targets')" />
  </ImportGroup>
  <Target Name="EnsureNuGetPackageBuildImports">
    <Error Condition="!Exists('old-props')" Text="Missing VideoLAN.LibVLC.UWP.props" />
  </Target>
</Project>`,
      "utf8",
    );
    await writeFile(
      path.join(root, "UpdateManifest.ps1"),
      `$h["DEBUG"] = @{
Name = "38833FF26BA1D.UnigramExperimental";
Publisher = "CN=D89C87B4-2758-402A-8F40-3571D00882AB";
DisplayName = "Unigram Experimental";
PublisherDisplayName = "Unigram, Inc.";
AppName = "Telegram"
}
$h["RELEASE"] = @{
Name = "38833FF26BA1D.UnigramPreview";
Publisher = "CN=D89C87B4-2758-402A-8F40-3571D00882AB";
DisplayName = ("Unigram{0}Telegram for Windows" -f [char]0x2014);
PublisherDisplayName = "Unigram, Inc.";
AppName = "Unigram"
}
$h["DIRECT"] = @{
Name = "TelegramFZ-LLC.Windows";
Publisher = 'CN=Telegram FZ-LLC, O=Telegram FZ-LLC';
DisplayName = ("Unigram{0}Telegram for Windows" -f [char]0x2014);
PublisherDisplayName = "Telegram FZ-LLC";
AppName = "Unigram"
}`,
      "utf8",
    );
    await writeFile(
      path.join(
        root,
        "packages",
        "VideoLAN.LibVLC.UWP.3.3.2",
        "build",
        "VideoLAN.LibVLC.UWP.targets",
      ),
      `<Project>
  <ItemGroup>
    <SDKReference Include="Microsoft.VCLibs.120, Version=14.0">
      <Name>Microsoft Visual C++ 2013 Runtime Package for Windows Universal</Name>
    </SDKReference>
  </ItemGroup>
</Project>`,
      "utf8",
    );

    const powershell = process.platform === "win32" ? "powershell" : "pwsh";
    await execFileAsync(powershell, [
      "-NoProfile",
      "-File",
      path.resolve("scripts/prepare-release.ps1"),
      "-Source",
      root,
      "-ApiId",
      "12345",
      "-ApiHash",
      "0123456789abcdef0123456789abcdef",
    ]);
    await execFileAsync(powershell, [
      "-NoProfile",
      "-File",
      path.resolve("scripts/prepare-libvlc-package.ps1"),
      "-Source",
      root,
    ]);

    const project = await readFile(path.join(root, "Telegram", "Telegram.csproj"), "utf8");
    const nativePackages = await readFile(path.join(root, "Telegram.Native", "packages.config"), "utf8");
    const nativeProject = await readFile(path.join(root, "Telegram.Native", "Telegram.Native.vcxproj"), "utf8");
    const secret = await readFile(path.join(root, "Telegram", "Constants.Secret.cs"), "utf8");
    const nativeCallsStub = await readFile(
      path.join(root, "Telegram", "NativeCallsStub.cs"),
      "utf8",
    );
    const messageDelegate = await readFile(
      path.join(root, "Telegram", "ViewModels", "MessageDelegate.cs"),
      "utf8",
    );
    const manifestScript = await readFile(path.join(root, "UpdateManifest.ps1"), "utf8");
    const libVlcTargets = await readFile(
      path.join(
        root,
        "packages",
        "VideoLAN.LibVLC.UWP.3.3.2",
        "build",
        "VideoLAN.LibVLC.UWP.targets",
      ),
      "utf8",
    );
    const libVlcMediaHeader = await readFile(
      path.join(
        root,
        "packages",
        "VideoLAN.LibVLC.UWP.3.3.2",
        "build",
        "win10-x64",
        "sdk",
        "include",
        "vlc",
        "libvlc_media.h",
      ),
      "utf8",
    );
    expect(project).not.toContain("ENABLE_CALLS");
    expect(project).not.toContain("Telegram.Native.Calls");
    expect(project).toContain('<Compile Include="NativeCallsStub.cs" />');
    expect(project).toContain("<Version>3.3.2</Version>");
    expect(nativePackages).toContain('VideoLAN.LibVLC.UWP" version="3.3.2"');
    expect(nativePackages).not.toContain("3.0.22-rc1");
    expect(nativeProject).toContain("VideoLAN.LibVLC.UWP.3.3.2\\build\\VideoLAN.LibVLC.UWP.targets");
    expect(nativeProject).toContain("build\\win10-x64\\sdk\\include");
    expect(nativeProject).toContain("libvlc.lib;libvlccore.lib");
    expect(nativeProject).not.toContain("VideoLAN.LibVLC.UWP.props");
    expect(secret).toContain("ApiId = 12345;");
    expect(secret).toContain('ApiHash = "0123456789abcdef0123456789abcdef";');
    expect(nativeCallsStub).toContain("namespace Telegram.Native.Calls");
    expect(nativeCallsStub).not.toContain("public enum VoipDataSaving");
    expect(nativeCallsStub).toContain("public sealed class VoipGroupManager");
    expect(nativeCallsStub).toContain("public sealed class VoipVideoOutputSink");
    expect(messageDelegate).toContain("using System.Threading.Tasks;");
    expect(manifestScript.match(/CrossgramProject\.CrossgramUnigram/g)).toHaveLength(3);
    expect(manifestScript.match(/Crossgram Unigram/g)?.length).toBeGreaterThanOrEqual(6);
    expect(libVlcTargets).toContain('SDKReference Include="Microsoft.VCLibs, Version=14.0"');
    expect(libVlcTargets).not.toContain("Microsoft.VCLibs.120");
    expect(libVlcMediaHeader).toContain("typedef SSIZE_T ssize_t;");
    expect(libVlcMediaHeader).toContain("_SSIZE_T_DEFINED");
  });
});

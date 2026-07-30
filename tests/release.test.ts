import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Windows release contract", () => {
  it("builds patched TDLib and publishes installable assets", async () => {
    const workflow = await readFile(path.resolve(".github/workflows/release.yml"), "utf8");
    expect(workflow).toContain("crossgram-project/crossgram-tdlib");
    expect(workflow).toContain("Libraries/CoreWindowCustomDPI");
    expect(workflow).not.toContain("--recurse-submodules");
    expect(workflow).toContain("choco install gperf --yes --no-progress");
    expect(workflow).toContain("Get-Command gperf.exe");
    expect(workflow).toContain("prepare-libvlc-package.ps1 -Source upstream");
    expect(workflow).toContain("boost-regex:x64-uwp");
    expect(workflow).toContain("ffmpeg:x64-uwp");
    expect(workflow).toContain("libyuv:x64-uwp");
    expect(workflow).toContain("lz4:x64-uwp");
    expect(workflow).toContain("nu-book-zxing-cpp:x64-uwp");
    expect(workflow).not.toContain("ffmpeg[dav1d,opus,vpx]:x64-uwp");
    expect(workflow).toContain("PSNativeCommandUseErrorActionPreference");
    expect(workflow).toContain("actions/cache/restore@v4");
    expect(workflow).toContain("actions/cache/save@v4");
    expect(workflow).toContain("x64-uwp-cff6ed4-full-v6");
    expect(workflow).not.toContain("vcpkg\\downloads");
    expect(workflow).toContain("Apply direct-download TDLib source patch");
    expect(workflow).toContain('${{ github.workspace }}\\upstream\\Libraries\\tdlib');
    expect(workflow).toContain("Verify direct-download TDLib for UWP");
    expect(workflow).toContain("Push-Location upstream\\Libraries\\tdjson");
    expect(workflow).toContain("& .\\build.ps1");
    expect(workflow).toContain("Telegram.Msix\\Telegram.Msix.wapproj");
    expect(workflow).toContain("AppPackages");
    expect(workflow).toContain("softprops/action-gh-release");
    expect(workflow).toContain("bridge-media:` direct downloads");
  });

  it("prepares a distinct signed package without the private WebRTC tree", async () => {
    const script = await readFile(path.resolve("scripts/prepare-release.ps1"), "utf8");
    expect(script).toContain("CrossgramProject.CrossgramUnigram");
    expect(script).toContain("Constants.Secret.cs");
    expect(script).toContain("Telegram\\.Native\\.Calls");
    expect(script).toContain("ENABLE_CALLS;");
    expect(script).toContain('$libVlcVersion = "3.3.2"');
    expect(script).toContain("libvlc.lib;libvlccore.lib");
    expect(script).toContain("UTF8Encoding");
  });

  it("normalizes the restored LibVLC runtime SDK reference", async () => {
    const script = await readFile(path.resolve("scripts/prepare-libvlc-package.ps1"), "utf8");
    expect(script).toContain("Microsoft.VCLibs.120, Version=14.0");
    expect(script).toContain("Microsoft.VCLibs, Version=14.0");
    expect(script).toContain("UTF8Encoding");
  });
});

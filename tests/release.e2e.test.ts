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
    await writeFile(
      path.join(root, "Telegram", "Telegram.csproj"),
      `<Project>
  <PropertyGroup><DefineConstants>TRACE;ENABLE_CALLS;CODE_ANALYSIS</DefineConstants></PropertyGroup>
  <ItemGroup>
    <ProjectReference Include="..\\Telegram.Native.Calls\\Telegram.Native.Calls.vcxproj">
      <Project>{FDD3C45D-4CFF-4A90-8FEF-16CA70AB00BE}</Project>
    </ProjectReference>
  </ItemGroup>
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

    const project = await readFile(path.join(root, "Telegram", "Telegram.csproj"), "utf8");
    const secret = await readFile(path.join(root, "Telegram", "Constants.Secret.cs"), "utf8");
    const manifestScript = await readFile(path.join(root, "UpdateManifest.ps1"), "utf8");
    expect(project).not.toContain("ENABLE_CALLS");
    expect(project).not.toContain("Telegram.Native.Calls");
    expect(secret).toContain("ApiId = 12345;");
    expect(secret).toContain('ApiHash = "0123456789abcdef0123456789abcdef";');
    expect(manifestScript.match(/CrossgramProject\.CrossgramUnigram/g)).toHaveLength(3);
    expect(manifestScript.match(/Crossgram Unigram/g)?.length).toBeGreaterThanOrEqual(6);
  });
});

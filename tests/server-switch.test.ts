import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const featureRoot = path.resolve("features/server-switch/files");

describe("Unigram server switch integration", () => {
  it("queues the Crossgram option before TDLib parameters without awaiting its callback", async () => {
    const patcher = await readFile(path.resolve("src/patch.ts"), "utf8");
    const option = patcher.indexOf("CrossgramServerConfiguration.TdlibOptionName");
    const parameters = patcher.indexOf("_client.Send(new SetTdlibParameters(", option);

    expect(option).toBeGreaterThan(-1);
    expect(parameters).toBeGreaterThan(option);
    expect(patcher.slice(option, parameters)).not.toContain("optionResult =>");
    expect(patcher).toContain("doesn't resolve SetOption");
    expect(patcher).toContain("would deadlock startup and leave the root frame black");
    expect(patcher).toContain("AppRestartFailureReason.RestartPending");
    expect(patcher).not.toContain("AppRestartFailureReason.None");
    expect(patcher).toContain("patchAuthorizationQrRefresh(source)");
  });

  it("keeps official and custom databases isolated", async () => {
    const store = await readFile(
      path.join(
        featureRoot,
        "Telegram/Crossgram/CrossgramServerConfigurationStore.cs",
      ),
      "utf8",
    );
    expect(store).toContain('Path.Combine(official, "crossgram", configuration.DatabaseNamespace)');
    expect(store).toContain("? official");
  });

  it("patches TDLib before Unigram configures native builds", async () => {
    const patcher = await readFile(path.resolve("src/patch.ts"), "utf8");
    expect(patcher).toContain("corepack yarn patch:source --source");
    expect(patcher).toContain("CrossgramServerConfig.cpp");
    expect(patcher).toContain("CROSSGRAM_TDLIB_PATCHER");
  });

  it("documents inherited bridge-media direct downloads", async () => {
    const readme = await readFile(path.resolve("README.md"), "utf8");
    expect(readme).toContain("bridge-media:");
    expect(readme).toContain("crossgram.getFileUrl");
    expect(readme).toContain("upload.getFile");
    expect(readme).toContain("GitHub Releases");
  });
});

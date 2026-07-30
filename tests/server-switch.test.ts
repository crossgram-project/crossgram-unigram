import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const featureRoot = path.resolve("features/server-switch/files");

describe("Unigram server switch integration", () => {
  it("waits for the Crossgram option before TDLib parameters", async () => {
    const patcher = await readFile(path.resolve("src/patch.ts"), "utf8");
    const option = patcher.indexOf("CrossgramServerConfiguration.TdlibOptionName");
    const callback = patcher.indexOf("optionResult =>", option);
    const parameters = patcher.indexOf("_client.Send(new SetTdlibParameters(", callback);

    expect(option).toBeGreaterThan(-1);
    expect(callback).toBeGreaterThan(option);
    expect(parameters).toBeGreaterThan(callback);
    expect(patcher).toContain("if (optionResult is Error optionError)");
    expect(patcher).toContain("AppRestartFailureReason.RestartPending");
    expect(patcher).not.toContain("AppRestartFailureReason.None");
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

import { copyFile, mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { patchUnigram } from "../src/patch.js";

const sourceRoot = process.env.CROSSGRAM_UNIGRAM_SOURCE;
const inputs = [
  "Telegram/Services/ClientService.cs",
  "Telegram/ViewModels/Authorization/AuthorizationViewModel.cs",
  "Telegram/Views/Authorization/AuthorizationPage.xaml",
  "Telegram/Telegram.csproj",
  "Libraries/tdjson/build.ps1",
  "Documentation/Build-instructions.md",
];

describe("current Unigram source patch", () => {
  let root = "";

  beforeAll(async () => {
    if (!sourceRoot) throw new Error("CROSSGRAM_UNIGRAM_SOURCE must point to an Unigram checkout");
    root = await mkdtemp(path.join(os.tmpdir(), "crossgram-unigram-e2e-"));
    for (const relative of inputs) {
      const target = path.join(root, relative);
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(path.join(sourceRoot, relative), target);
    }
  });

  afterAll(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("patches real upstream anchors and is idempotent", async () => {
    const first = await patchUnigram(root);
    expect(first.changedFiles).toEqual([
      "Documentation/Build-instructions.md",
      "Libraries/tdjson/build.ps1",
      "Telegram/Crossgram/CrossgramServerConfiguration.cs",
      "Telegram/Crossgram/CrossgramServerConfigurationStore.cs",
      "Telegram/Crossgram/ServerConfigurationPopup.xaml",
      "Telegram/Crossgram/ServerConfigurationPopup.xaml.cs",
      "Telegram/Services/ClientService.cs",
      "Telegram/Telegram.csproj",
      "Telegram/ViewModels/Authorization/AuthorizationViewModel.cs",
      "Telegram/Views/Authorization/AuthorizationPage.xaml",
    ]);
    expect((await patchUnigram(root)).changedFiles).toEqual([]);

    const client = await readFile(path.join(root, "Telegram/Services/ClientService.cs"), "utf8");
    const viewModel = await readFile(
      path.join(root, "Telegram/ViewModels/Authorization/AuthorizationViewModel.cs"),
      "utf8",
    );
    const build = await readFile(path.join(root, "Libraries/tdjson/build.ps1"), "utf8");

    const option = client.indexOf("CrossgramServerConfiguration.TdlibOptionName");
    const parameters = client.indexOf("new SetTdlibParameters(", option);
    expect(option).toBeGreaterThan(-1);
    expect(parameters).toBeGreaterThan(option);
    expect(client).toContain("CrossgramServerConfigurationStore.DatabaseDirectory");
    expect(viewModel).toContain('RequestRestartAsync("crossgram-server-switch")');
    expect(build).toContain("corepack yarn patch:source --source");
  });
});

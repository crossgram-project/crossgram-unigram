import { copyFile, mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { patchUnigram } from "../src/patch.js";

const sourceRoot = process.env.CROSSGRAM_UNIGRAM_SOURCE;
const inputs = [
  "Telegram/Services/ClientService.cs",
  "Telegram/Td/Client.cs",
  "Telegram/Td/ClientJson.cs",
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
      "Telegram/Crossgram/ServerConfigurationPopup.xaml.cs",
      "Telegram/Services/ClientService.cs",
      "Telegram/Td/Client.cs",
      "Telegram/Td/ClientJson.cs",
      "Telegram/Telegram.csproj",
      "Telegram/ViewModels/Authorization/AuthorizationViewModel.cs",
      "Telegram/Views/Authorization/AuthorizationPage.xaml",
    ]);
    expect((await patchUnigram(root)).changedFiles).toEqual([]);

    const client = await readFile(path.join(root, "Telegram/Services/ClientService.cs"), "utf8");
    const tdClient = await readFile(path.join(root, "Telegram/Td/Client.cs"), "utf8");
    const clientJson = await readFile(path.join(root, "Telegram/Td/ClientJson.cs"), "utf8");
    const viewModel = await readFile(
      path.join(root, "Telegram/ViewModels/Authorization/AuthorizationViewModel.cs"),
      "utf8",
    );
    const build = await readFile(path.join(root, "Libraries/tdjson/build.ps1"), "utf8");

    const option = client.indexOf("CrossgramServerConfiguration.TdlibOptionName");
    const parameters = client.indexOf("new SetTdlibParameters(", option);
    expect(option).toBeGreaterThan(-1);
    expect(parameters).toBeGreaterThan(option);
    expect(client.slice(option, parameters)).not.toContain("optionResult =>");
    expect(client).toContain("would deadlock startup and leave the root frame black");
    expect(client).toContain("CrossgramServerConfigurationStore.DatabaseDirectory");
    expect(tdClient).toContain("private static extern unsafe void td_send(int client_id, byte* request);");
    expect(tdClient).toContain("private static extern unsafe byte* td_receive(double timeout);");
    expect(tdClient).toContain("ClientJson.ToJson(_writer, function, requestId)");
    expect(tdClient).toContain("ClientJson.ReadRoutingMetadata(span, out clientId, out requestId);");
    expect(tdClient).not.toContain("td_send(int client_id, long request_id");
    expect(clientJson).toContain('_writer.WriteNumber("@extra", requestId);');
    expect(clientJson).toContain('reader.ValueTextEquals("@client_id"u8)');
    expect(clientJson).toContain('reader.ValueTextEquals("@extra"u8)');
    expect(viewModel).toContain('RequestRestartAsync("crossgram-server-switch")');
    expect(viewModel).toContain("AppRestartFailureReason.RestartPending");
    expect(viewModel).not.toContain("AppRestartFailureReason.None");
    expect(viewModel).toContain("The TDLib authorization state is authoritative.");
    const qrState = viewModel.indexOf("AuthorizationStateWaitOtherDeviceConfirmation waitOtherDeviceConfirmation");
    const qrStateEnd = viewModel.indexOf("return Task.CompletedTask;", qrState);
    expect(qrState).toBeGreaterThan(-1);
    expect(qrStateEnd).toBeGreaterThan(qrState);
    expect(viewModel.slice(qrState, qrStateEnd)).not.toContain("mode != NavigationMode.Refresh");
    expect(viewModel).toContain("private bool _switchingToPhoneNumber;");
    expect(viewModel).toContain("var currentAuthState = ClientService.AuthorizationState;");
    expect(viewModel).toContain("if (!_switchingToPhoneNumber)");
    expect(viewModel).toContain("_switchingToPhoneNumber = true;");
    expect(build).toContain("corepack yarn patch:source --source");
  });
});

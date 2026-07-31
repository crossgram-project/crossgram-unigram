import path from "node:path";
import { fileURLToPath } from "node:url";

import { readUtf8, writeUtf8IfChanged } from "./core/files.js";
import {
  patchAuthorizationQrRefresh,
  patchAuthorizationRequestTransition,
} from "./core/authorization.js";
import { patchTdJsonClient, patchTdJsonSerialization } from "./core/tdjson-abi.js";
import { insertAfterOnce, insertBeforeOnce, replaceOnce } from "./core/text-edit.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const featureRoot = path.join(repositoryRoot, "features", "server-switch", "files");

export interface PatchResult {
  changedFiles: string[];
}

async function editFile(
  root: string,
  relative: string,
  changedFiles: string[],
  edit: (source: string) => string,
): Promise<void> {
  const file = path.join(root, relative);
  const original = await readUtf8(file);
  const crlf = original.includes("\r\n");
  let updated = edit(original.replaceAll("\r\n", "\n"));
  if (crlf) updated = updated.replaceAll("\n", "\r\n");
  if (await writeUtf8IfChanged(file, updated)) changedFiles.push(relative);
}

async function installFile(
  root: string,
  relative: string,
  changedFiles: string[],
): Promise<void> {
  const content = await readUtf8(path.join(featureRoot, relative));
  if (await writeUtf8IfChanged(path.join(root, relative), content)) changedFiles.push(relative);
}

const parametersAnchor = `                _client.Send(new SetTdlibParameters(
                    useTestDc: _settings.UseTestDC,
                    databaseDirectory: System.IO.Path.Combine(ApplicationData.Current.LocalFolder.Path, $"{_session.Id}"),
                    filesDirectory: string.Empty,
                    databaseEncryptionKey: null,
                    useFileDatabase: true,
                    useChatInfoDatabase: true,
                    useMessageDatabase: useMessageDatabase,
                    useSecretChats: true,
                    apiId: Constants.ApiId,
                    apiHash: Constants.ApiHash,
                    systemLanguageCode: _deviceInfoService.SystemLanguageCode,
                    deviceModel: deviceModel,
                    systemVersion: _deviceInfoService.SystemVersion,
                    applicationVersion: _deviceInfoService.ApplicationVersion));
                Send(new GetApplicationConfig(), UpdateConfig);`;

const parametersReplacement = `                var crossgramConfiguration = CrossgramServerConfigurationStore.Load(_session.Id);
                var databaseDirectory = CrossgramServerConfigurationStore.DatabaseDirectory(
                    ApplicationData.Current.LocalFolder.Path,
                    _session.Id,
                    crossgramConfiguration);
                OptionValue crossgramOptionValue = crossgramConfiguration == null
                    ? new OptionValueEmpty()
                    : new OptionValueString(crossgramConfiguration.Serialize());

                // TDLib processes these requests in order, but doesn't resolve SetOption
                // until SetTdlibParameters completes initialization. Waiting for the option
                // callback here would deadlock startup and leave the root frame black.
                _client.Send(new SetOption(
                    CrossgramServerConfiguration.TdlibOptionName,
                    crossgramOptionValue));

                _client.Send(new SetTdlibParameters(
                    useTestDc: _settings.UseTestDC,
                    databaseDirectory: databaseDirectory,
                    filesDirectory: string.Empty,
                    databaseEncryptionKey: null,
                    useFileDatabase: true,
                    useChatInfoDatabase: true,
                    useMessageDatabase: useMessageDatabase,
                    useSecretChats: true,
                    apiId: Constants.ApiId,
                    apiHash: Constants.ApiHash,
                    systemLanguageCode: _deviceInfoService.SystemLanguageCode,
                    deviceModel: deviceModel,
                    systemVersion: _deviceInfoService.SystemVersion,
                    applicationVersion: _deviceInfoService.ApplicationVersion));
                Send(new GetApplicationConfig(), UpdateConfig);`;

export async function patchUnigram(root: string): Promise<PatchResult> {
  const changedFiles: string[] = [];
  for (const relative of [
    "Telegram/Crossgram/CrossgramServerConfiguration.cs",
    "Telegram/Crossgram/CrossgramServerConfigurationStore.cs",
    "Telegram/Crossgram/ServerConfigurationPopup.xaml.cs",
  ]) {
    await installFile(root, relative, changedFiles);
  }

  await editFile(root, "Telegram/Services/ClientService.cs", changedFiles, (source) => {
    source = insertAfterOnce(
      source,
      "using Telegram.Common;",
      "\nusing Telegram.Crossgram;",
      "using Telegram.Crossgram;",
      "Telegram/Services/ClientService.cs",
    );
    return replaceOnce(
      source,
      parametersAnchor,
      parametersReplacement,
      "CrossgramServerConfiguration.TdlibOptionName",
      "Telegram/Services/ClientService.cs",
    );
  });

  await editFile(
    root,
    "Telegram/ViewModels/Authorization/AuthorizationViewModel.cs",
    changedFiles,
    (source) => {
      source = insertAfterOnce(
        source,
        "using Telegram.Common;",
        "\nusing Telegram.Crossgram;",
        "using Telegram.Crossgram;",
        "Telegram/ViewModels/Authorization/AuthorizationViewModel.cs",
      );
      source = insertAfterOnce(
        source,
        "using Telegram.Views.Settings;",
        "\nusing Windows.ApplicationModel.Core;",
        "using Windows.ApplicationModel.Core;",
        "Telegram/ViewModels/Authorization/AuthorizationViewModel.cs",
      );
      source = insertBeforeOnce(
        source,
        "        public void Proxy()",
        `        public async void Server()
        {
            var popup = new ServerConfigurationPopup(
                CrossgramServerConfigurationStore.LoadRaw(Session.Id));
            var result = await ShowPopupAsync(popup);
            if (result == ContentDialogResult.Primary)
            {
                CrossgramServerConfigurationStore.Save(Session.Id, popup.Configuration);
            }
            else if (result == ContentDialogResult.Secondary)
            {
                CrossgramServerConfigurationStore.Clear(Session.Id);
            }
            else
            {
                return;
            }

            var restart = await CoreApplication.RequestRestartAsync("crossgram-server-switch");
            if (restart != AppRestartFailureReason.RestartPending)
            {
                await ShowPopupAsync(
                    "The server selection was saved. Restart Unigram manually to apply it.",
                    "Server configuration",
                    Strings.OK);
            }
        }

`,
        "crossgram-server-switch",
        "Telegram/ViewModels/Authorization/AuthorizationViewModel.cs",
      );
      source = patchAuthorizationQrRefresh(source);
      return patchAuthorizationRequestTransition(source);
    },
  );

  await editFile(root, "Telegram/Views/Authorization/AuthorizationPage.xaml", changedFiles, (source) =>
    insertBeforeOnce(
      source,
      `        <Button x:Name="Proxy"`,
      `        <Button Click="{x:Bind ViewModel.Server}"
                Content="Server"
                Style="{StaticResource AccentTextButtonStyle}"
                HorizontalAlignment="Left"
                Margin="12,0"
                Grid.Row="1" />

`,
      'Content="Server"',
      "Telegram/Views/Authorization/AuthorizationPage.xaml",
    ));

  await editFile(root, "Telegram/Telegram.csproj", changedFiles, (source) => {
    return insertBeforeOnce(
      source,
      '    <Compile Include="Views\\Settings\\SettingsProxyPopup.xaml.cs">',
      `    <Compile Include="Crossgram\\CrossgramServerConfiguration.cs" />
    <Compile Include="Crossgram\\CrossgramServerConfigurationStore.cs" />
    <Compile Include="Crossgram\\ServerConfigurationPopup.xaml.cs" />
`,
      'Compile Include="Crossgram\\CrossgramServerConfiguration.cs"',
      "Telegram/Telegram.csproj",
    );
  });

  await editFile(root, "Telegram/Td/Client.cs", changedFiles, patchTdJsonClient);
  await editFile(root, "Telegram/Td/ClientJson.cs", changedFiles, patchTdJsonSerialization);

  await editFile(root, "Libraries/tdjson/build.ps1", changedFiles, (source) => {
    source = replaceOnce(
      source,
      '  [string]$mode = "all"\n)',
      '  [string]$mode = "all",\n  [string]$crossgram_tdlib_patcher = $env:CROSSGRAM_TDLIB_PATCHER\n)',
      "$crossgram_tdlib_patcher = $env:CROSSGRAM_TDLIB_PATCHER",
      "Libraries/tdjson/build.ps1",
    );
    source = insertBeforeOnce(
      source,
      "function clean {",
      `function apply_crossgram_tdlib {
  if (Test-Path "$td_root/td/telegram/CrossgramServerConfig.cpp") {
    return
  }
  if ([string]::IsNullOrWhiteSpace($crossgram_tdlib_patcher)) {
    throw "-crossgram_tdlib_patcher=<path> or CROSSGRAM_TDLIB_PATCHER is required"
  }
  $patcher_root = Resolve-Path $crossgram_tdlib_patcher
  Push-Location $patcher_root
  Try {
    corepack yarn install --immutable
    CheckLastExitCode
    corepack yarn patch:source --source "$td_root"
    CheckLastExitCode
  } Finally {
    Pop-Location
  }
}

`,
      "function apply_crossgram_tdlib",
      "Libraries/tdjson/build.ps1",
    );
    return insertAfterOnce(
      source,
      "function run {\n  Push-Location\n  Try {",
      `
    if (($mode -ne "clean") -and ($mode -ne "export")) {
      apply_crossgram_tdlib
    }`,
      "apply_crossgram_tdlib\n    }",
      "Libraries/tdjson/build.ps1",
    );
  });

  await editFile(root, "Documentation/Build-instructions.md", changedFiles, (source) =>
    insertAfterOnce(
      source,
      "In order to communicate with Telegram servers, Unigram uses TDLib.",
      `

Crossgram builds must clone
[crossgram-tdlib](https://github.com/crossgram-project/crossgram-tdlib) and pass
its path through \`-crossgram_tdlib_patcher\` or \`CROSSGRAM_TDLIB_PATCHER\`
when running \`Libraries/tdjson/build.ps1\`. The build script applies the
shared native server-switch implementation before configuring TDLib.`,
      "CROSSGRAM_TDLIB_PATCHER",
      "Documentation/Build-instructions.md",
    ));

  changedFiles.sort();
  return { changedFiles };
}

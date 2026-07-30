# Crossgram Unigram patcher

Crossgram Unigram adds per-account Crossgram server selection and direct
`bridge-media:` downloads to current
[Unigram](https://github.com/UnigramDev/Unigram) source and connects its bundled
TDLib build to
[crossgram-tdlib](https://github.com/crossgram-project/crossgram-tdlib).

The repository is a semantic, idempotent source patcher, matching the delivery
model used by Crossgram Android and Desktop. It keeps the upstream history and
large native dependencies outside this repository.

## Behavior

- The signed-out page has a **Server** action.
- The editor accepts the shared Crossgram JSON schema and validates it before
  saving.
- **Official Telegram** clears the per-account custom selection.
- Unigram restarts after a change because TDLib accepts the server option only
  before setTdlibParameters.
- Official Telegram keeps Unigram's existing account directory.
- A custom server uses
  LocalState/session/crossgram/configuration-hash, preventing authorization
  keys and cached DC state from crossing server boundaries.
- x_crossgram_server_configuration is sent and acknowledged before
  setTdlibParameters. A native rejection fails closed.
- The patched TDLib resolves `bridge-media:` document and photo references
  through `crossgram.getFileUrl`, downloads exact HTTP byte ranges directly,
  and falls back to relay `upload.getFile` on any resolver, metadata, HTTP, or
  range validation failure.

The C# normalizer mirrors crossgram-tdlib: it fills missing DC IDs 1–5, creates
a deterministic ID, produces canonical JSON, and derives the same database
namespace. Cross-language tests lock those values to the shared test vector.

## Apply to Unigram

Requires Node.js 22 or newer.

~~~powershell
corepack enable
corepack yarn install --immutable
corepack yarn patch:source --source D:\src\Unigram
~~~

Repeated application is supported and produces no further changes.

## Build patched TDLib

Initialize Unigram's Libraries/tdlib submodule, clone crossgram-tdlib, then pass
the patcher path to Unigram's existing TDLib build script:

~~~powershell
$env:CROSSGRAM_TDLIB_PATCHER = 'D:\src\crossgram-tdlib'
Set-Location D:\src\Unigram\Libraries\tdjson
.\build.ps1 -vcpkg_root D:\src\vcpkg -arch x64,ARM64
~~~

The build script applies the shared TDLib source integration before CMake
configuration and skips the operation when the source is already patched. The
shared integration contains both server switching and direct media downloads.

## Download

Installable x64 Windows packages are published in
[GitHub Releases](https://github.com/crossgram-project/crossgram-unigram/releases).
Download the release ZIP, extract it, and run `Add-AppDevPackage.ps1` from the
extracted AppPackages directory. Windows may ask you to trust the included
test-signing certificate for sideloading.

## Server JSON

~~~json
{
  "name": "Office Crossgram",
  "enable_special_config": false,
  "host": "192.168.1.100",
  "port": 4430,
  "rsa_key": "-----BEGIN RSA PUBLIC KEY-----\n...\n-----END RSA PUBLIC KEY-----",
  "dcs": [
    { "id": 1, "ip": "192.168.1.100", "port": 4430 }
  ]
}
~~~

The id is optional and generated deterministically. Hosts and DC addresses must
be IPv4 or IPv6 literals, ports must be 1–65535, DC IDs must be unique, and the
key must be a PKCS#1 public-key PEM. Native TDLib performs the final RSA parse.

## Verification

~~~powershell
corepack yarn check
dotnet test tests/dotnet/Crossgram.Unigram.Tests.csproj
$env:CROSSGRAM_UNIGRAM_SOURCE = 'D:\src\Unigram'
corepack yarn e2e:source
~~~

Tests cover semantic edit failure modes, startup ordering, database isolation,
TDLib build integration, six C# normalization/validation cases, idempotency,
and real current Unigram source anchors.

## License

The patcher is MIT licensed. Patched Unigram remains GPL-3.0 under its upstream
license, and patched TDLib retains its Boost Software License.

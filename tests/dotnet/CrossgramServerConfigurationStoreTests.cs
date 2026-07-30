using System.IO;
using Telegram.Crossgram;
using Xunit;

namespace Crossgram.Unigram.Tests;

public sealed class CrossgramServerConfigurationStoreTests
{
    private const string Configuration = """
{
  "id": "office-qq",
  "name": "Office",
  "enable_special_config": false,
  "host": "127.0.0.1",
  "port": 4430,
  "rsa_key": "-----BEGIN RSA PUBLIC KEY-----\nAQAB\n-----END RSA PUBLIC KEY-----"
}
""";

    [Fact]
    public void PersistsNormalizedConfigurationPerSession()
    {
        const int session = 42;
        CrossgramServerConfigurationStore.Clear(session);
        Assert.Null(CrossgramServerConfigurationStore.Load(session));

        var parsed = CrossgramServerConfiguration.Parse(Configuration);
        CrossgramServerConfigurationStore.Save(session, parsed);

        Assert.Equal("office-qq", CrossgramServerConfigurationStore.Load(session).Id);
        Assert.Equal(parsed.Serialize(), CrossgramServerConfigurationStore.LoadRaw(session));
        Assert.Null(CrossgramServerConfigurationStore.Load(session + 1));
    }

    [Fact]
    public void IsolatesCustomDatabaseFromOfficialDirectory()
    {
        var parsed = CrossgramServerConfiguration.Parse(Configuration);
        var official = CrossgramServerConfigurationStore.DatabaseDirectory("root", 7, null);
        var custom = CrossgramServerConfigurationStore.DatabaseDirectory("root", 7, parsed);

        Assert.Equal(Path.Combine("root", "7"), official);
        Assert.Equal(
            Path.Combine("root", "7", "crossgram", parsed.DatabaseNamespace),
            custom);
        Assert.NotEqual(official, custom);
    }
}

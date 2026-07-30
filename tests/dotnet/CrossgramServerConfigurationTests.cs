using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Telegram.Crossgram;
using Xunit;

namespace Crossgram.Unigram.Tests;

public sealed class CrossgramServerConfigurationTests
{
    private const string RsaKey = """
-----BEGIN RSA PUBLIC KEY-----
MIIBCgKCAQEA6LszBcC1LGzyr992NzE0ieY+BSaOW622Aa9Bd4ZHLl+TuFQ4lo4g
5nKaMBwK/BIb9xUfg0Q29/2mgIR6Zr9krM7HjuIcCzFvDtr+L0GQjae9H0pRB2OO
62cECs5HKhT5DZ98K33vmWiLowc621dQuwKWSQKjWf50XYFw42h21P2KXUGyp2y/
+aEyZ+uVgLLQbRA1dEjSDZ2iGRy12Mk5gpYc397aYp438fsJoHIgJ2lgMv5h7WY9
t6N/byY9Nw9p21Og3AoXSL2q/2IJ1WRUhebgAdGVMlV1fkuOQoEzR7EdpqtQD9Cs
5+bfo3Nhmcyvk5ftB0WkJ9z6bNZ7yxrP8wIDAQAB
-----END RSA PUBLIC KEY-----
""";

    [Fact]
    public void MatchesSharedCrossLanguageVector()
    {
        var config = CrossgramServerConfiguration.Parse(BaseJson(values =>
        {
            values["dcs"] = new object[]
            {
                new Dictionary<string, object>
                {
                    ["id"] = 2,
                    ["ip"] = "127.0.0.2",
                    ["port"] = 8443,
                },
            };
        }));

        Assert.Equal("crossgram-7d278243600017a2", config.Id);
        Assert.Equal("347c7018a8b923139e47", config.DatabaseNamespace);
        Assert.False(config.EnableSpecialConfig);
        Assert.Equal(new[] { 1, 2, 3, 4, 5 }, config.Datacenters.Select(dc => dc.Id));
        Assert.Equal("127.0.0.2", config.Datacenters.Single(dc => dc.Id == 2).Ip);
    }

    [Fact]
    public void DefaultsSpecialConfigAndPreservesExplicitId()
    {
        var config = CrossgramServerConfiguration.Parse(BaseJson(
            values => values["id"] = "office-qq",
            includeSpecialConfig: false));

        Assert.True(config.EnableSpecialConfig);
        Assert.Equal("office-qq", config.Id);
        Assert.Equal(config.Serialize(), CrossgramServerConfiguration.Parse(config.Serialize()).Serialize());
    }

    public static TheoryData<string, object, string> InvalidFields => new()
    {
        { "host", "example.com", "IPv4 or IPv6" },
        { "port", 70000, "between 1 and 65535" },
        { "rsa_key", "not a key", "PKCS#1" },
    };

    [Theory]
    [MemberData(nameof(InvalidFields))]
    public void RejectsInvalidFields(string field, object value, string expected)
    {
        var error = Assert.Throws<FormatException>(() =>
            CrossgramServerConfiguration.Parse(BaseJson(values => values[field] = value)));
        Assert.Contains(expected, error.Message);
    }

    [Fact]
    public void RejectsDuplicateDatacenters()
    {
        var error = Assert.Throws<FormatException>(() =>
            CrossgramServerConfiguration.Parse(BaseJson(values =>
            {
                values["dcs"] = new object[]
                {
                    new Dictionary<string, object>
                    {
                        ["id"] = 1,
                        ["ip"] = "127.0.0.1",
                        ["port"] = 4430,
                    },
                    new Dictionary<string, object>
                    {
                        ["id"] = 1,
                        ["ip"] = "127.0.0.2",
                        ["port"] = 4430,
                    },
                };
            })));
        Assert.Contains("duplicate id 1", error.Message);
    }

    private static string BaseJson(
        Action<Dictionary<string, object>> mutate = null,
        bool includeSpecialConfig = true)
    {
        var values = new Dictionary<string, object>
        {
            ["name"] = "Local Crossgram",
            ["host"] = "127.0.0.1",
            ["port"] = 4430,
            ["rsa_key"] = RsaKey,
        };
        if (includeSpecialConfig)
        {
            values["enable_special_config"] = false;
        }
        mutate?.Invoke(values);
        return JsonSerializer.Serialize(values);
    }
}

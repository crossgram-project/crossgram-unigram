using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;

namespace Telegram.Crossgram
{
    public sealed class CrossgramServerDc
    {
        public CrossgramServerDc(int id, string ip, int port)
        {
            Id = id;
            Ip = ip;
            Port = port;
        }

        public int Id { get; }
        public string Ip { get; }
        public int Port { get; }
    }

    public sealed class CrossgramServerConfiguration
    {
        public const string TdlibOptionName = "x_crossgram_server_configuration";

        private CrossgramServerConfiguration(
            string id,
            string name,
            bool enableSpecialConfig,
            string host,
            int port,
            string rsaKey,
            IReadOnlyList<CrossgramServerDc> datacenters)
        {
            Id = id;
            Name = name;
            EnableSpecialConfig = enableSpecialConfig;
            Host = host;
            Port = port;
            RsaKey = rsaKey;
            Datacenters = datacenters;
        }

        public string Id { get; }
        public string Name { get; }
        public bool EnableSpecialConfig { get; }
        public string Host { get; }
        public int Port { get; }
        public string RsaKey { get; }
        public IReadOnlyList<CrossgramServerDc> Datacenters { get; }

        public string DatabaseNamespace => HashPrefix(Id, 20);

        public static CrossgramServerConfiguration Parse(string json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                throw new FormatException("Server configuration must be a JSON object.");
            }

            try
            {
                using var document = JsonDocument.Parse(json);
                if (document.RootElement.ValueKind != JsonValueKind.Object)
                {
                    throw new FormatException("Server configuration must be a JSON object.");
                }

                var root = document.RootElement;
                var name = RequiredPropertyString(root, "name");
                var host = RequiredIp(root, "host");
                var port = RequiredPort(root, "port");
                var rsaKey = RequiredPropertyString(root, "rsa_key");
                if (!rsaKey.StartsWith("-----BEGIN RSA PUBLIC KEY-----", StringComparison.Ordinal)
                    || !rsaKey.EndsWith("-----END RSA PUBLIC KEY-----", StringComparison.Ordinal))
                {
                    throw new FormatException("rsa_key must be a PKCS#1 RSA public key PEM.");
                }

                var enableSpecialConfig = true;
                if (root.TryGetProperty("enable_special_config", out var special))
                {
                    if (special.ValueKind is not JsonValueKind.True and not JsonValueKind.False)
                    {
                        throw new FormatException("enable_special_config must be a boolean.");
                    }
                    enableSpecialConfig = special.GetBoolean();
                }

                var datacenters = new List<CrossgramServerDc>();
                var ids = new HashSet<int>();
                if (root.TryGetProperty("dcs", out var dcs))
                {
                    if (dcs.ValueKind != JsonValueKind.Array)
                    {
                        throw new FormatException("dcs must be an array.");
                    }

                    var index = 0;
                    foreach (var raw in dcs.EnumerateArray())
                    {
                        if (raw.ValueKind != JsonValueKind.Object)
                        {
                            throw new FormatException($"dcs[{index}] must be an object.");
                        }
                        if (!raw.TryGetProperty("id", out var idValue)
                            || !idValue.TryGetInt32(out var id)
                            || id < 1
                            || id > 1000)
                        {
                            throw new FormatException($"dcs[{index}].id must be an integer between 1 and 1000.");
                        }
                        if (!ids.Add(id))
                        {
                            throw new FormatException($"dcs contains duplicate id {id}.");
                        }
                        datacenters.Add(new CrossgramServerDc(
                            id,
                            RequiredIp(raw, "ip", $"dcs[{index}].ip"),
                            RequiredPort(raw, "port", $"dcs[{index}].port")));
                        index++;
                    }
                }

                for (var id = 1; id <= 5; id++)
                {
                    if (ids.Add(id))
                    {
                        datacenters.Add(new CrossgramServerDc(id, host, port));
                    }
                }
                datacenters.Sort((left, right) => left.Id.CompareTo(right.Id));

                var provisional = new CrossgramServerConfiguration(
                    string.Empty,
                    name,
                    enableSpecialConfig,
                    host,
                    port,
                    rsaKey,
                    datacenters);
                var idText = root.TryGetProperty("id", out var explicitId)
                    ? RequiredStringValue(explicitId, "id")
                    : $"crossgram-{HashPrefix(provisional.SerializeForId(), 16)}";
                return new CrossgramServerConfiguration(
                    idText,
                    name,
                    enableSpecialConfig,
                    host,
                    port,
                    rsaKey,
                    datacenters);
            }
            catch (JsonException error)
            {
                throw new FormatException($"Server configuration is invalid JSON: {error.Message}", error);
            }
        }

        public string Serialize()
        {
            using var stream = new MemoryStream();
            using (var writer = CreateWriter(stream))
            {
                writer.WriteStartObject();
                writer.WriteString("id", Id);
                writer.WriteString("name", Name);
                WriteConnectionProperties(writer);
                writer.WriteEndObject();
            }
            return Encoding.UTF8.GetString(stream.ToArray());
        }

        private string SerializeForId()
        {
            using var stream = new MemoryStream();
            using (var writer = CreateWriter(stream))
            {
                writer.WriteStartObject();
                WriteConnectionProperties(writer);
                writer.WriteEndObject();
            }
            return Encoding.UTF8.GetString(stream.ToArray());
        }

        private void WriteConnectionProperties(Utf8JsonWriter writer)
        {
            writer.WriteBoolean("enable_special_config", EnableSpecialConfig);
            writer.WriteString("host", Host);
            writer.WriteNumber("port", Port);
            writer.WriteString("rsa_key", RsaKey);
            writer.WriteStartArray("dcs");
            foreach (var dc in Datacenters)
            {
                writer.WriteStartObject();
                writer.WriteNumber("id", dc.Id);
                writer.WriteString("ip", dc.Ip);
                writer.WriteNumber("port", dc.Port);
                writer.WriteEndObject();
            }
            writer.WriteEndArray();
        }

        private static Utf8JsonWriter CreateWriter(Stream stream)
        {
            return new Utf8JsonWriter(stream, new JsonWriterOptions
            {
                Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
            });
        }

        private static string RequiredPropertyString(JsonElement owner, string property)
        {
            if (!owner.TryGetProperty(property, out var value))
            {
                throw new FormatException($"{property} must be a non-empty string.");
            }
            return RequiredStringValue(value, property);
        }

        private static string RequiredStringValue(JsonElement value, string field)
        {
            if (value.ValueKind != JsonValueKind.String)
            {
                throw new FormatException($"{field} must be a non-empty string.");
            }
            var result = value.GetString()?.Trim();
            if (string.IsNullOrEmpty(result))
            {
                throw new FormatException($"{field} must be a non-empty string.");
            }
            return result;
        }

        private static string RequiredIp(JsonElement owner, string property, string field = null)
        {
            var result = RequiredPropertyString(owner, property);
            if (!IPAddress.TryParse(result, out _))
            {
                throw new FormatException($"{field ?? property} must be an IPv4 or IPv6 address.");
            }
            return result;
        }

        private static int RequiredPort(JsonElement owner, string property, string field = null)
        {
            if (!owner.TryGetProperty(property, out var value)
                || !value.TryGetInt32(out var result)
                || result < 1
                || result > 65535)
            {
                throw new FormatException($"{field ?? property} must be an integer between 1 and 65535.");
            }
            return result;
        }

        private static string HashPrefix(string value, int length)
        {
            using var sha = SHA256.Create();
            var hash = sha.ComputeHash(Encoding.UTF8.GetBytes(value));
            var builder = new StringBuilder(hash.Length * 2);
            foreach (var item in hash)
            {
                builder.Append(item.ToString("x2"));
            }
            return builder.ToString(0, length);
        }
    }
}

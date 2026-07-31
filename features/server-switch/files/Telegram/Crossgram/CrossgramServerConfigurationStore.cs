using System.Collections.Generic;
using System.IO;
using Windows.Storage;

namespace Telegram.Crossgram
{
    public static class CrossgramServerConfigurationStore
    {
        private const string ConfigurationKey = "CrossgramServerConfiguration";
        private static readonly Dictionary<int, string> ProcessConfigurations = new();

        public static string LoadRaw(int sessionId)
        {
            var container = Container(sessionId);
            if (container.Values.TryGetValue(ConfigurationKey, out var value)
                && value is string persisted
                && !string.IsNullOrWhiteSpace(persisted))
            {
                ProcessConfigurations[sessionId] = persisted;
                return persisted;
            }
            if (ProcessConfigurations.TryGetValue(sessionId, out var cached))
            {
                // Unigram recreates TDLib while switching between QR and phone
                // authorization. Keep the selected server authoritative even if
                // session settings are cleared during that in-process handoff.
                container.Values[ConfigurationKey] = cached;
                return cached;
            }
            return string.Empty;
        }

        public static CrossgramServerConfiguration Load(int sessionId)
        {
            var raw = LoadRaw(sessionId);
            return string.IsNullOrWhiteSpace(raw)
                ? null
                : CrossgramServerConfiguration.Parse(raw);
        }

        public static void Save(int sessionId, CrossgramServerConfiguration configuration)
        {
            var serialized = configuration.Serialize();
            ProcessConfigurations[sessionId] = serialized;
            Container(sessionId).Values[ConfigurationKey] = serialized;
        }

        public static void Clear(int sessionId)
        {
            ProcessConfigurations.Remove(sessionId);
            Container(sessionId).Values.Remove(ConfigurationKey);
        }

        public static string DatabaseDirectory(string localFolder, int sessionId, CrossgramServerConfiguration configuration)
        {
            var official = Path.Combine(localFolder, sessionId.ToString());
            return configuration == null
                ? official
                : Path.Combine(official, "crossgram", configuration.DatabaseNamespace);
        }

        private static ApplicationDataContainer Container(int sessionId)
        {
            return ApplicationData.Current.LocalSettings.CreateContainer(
                sessionId.ToString(),
                ApplicationDataCreateDisposition.Always);
        }
    }
}

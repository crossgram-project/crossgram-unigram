using System.IO;
using Windows.Storage;

namespace Telegram.Crossgram
{
    public static class CrossgramServerConfigurationStore
    {
        private const string ConfigurationKey = "CrossgramServerConfiguration";

        public static string LoadRaw(int sessionId)
        {
            var container = Container(sessionId);
            return container.Values.TryGetValue(ConfigurationKey, out var value)
                ? value as string ?? string.Empty
                : string.Empty;
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
            Container(sessionId).Values[ConfigurationKey] = configuration.Serialize();
        }

        public static void Clear(int sessionId)
        {
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

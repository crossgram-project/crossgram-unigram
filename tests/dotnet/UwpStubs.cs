using System.Collections.Generic;
using Windows.UI.Xaml;
using Windows.UI.Xaml.Controls;

namespace Windows.Storage
{
    public enum ApplicationDataCreateDisposition
    {
        Always,
    }

    public sealed class ApplicationData
    {
        public static ApplicationData Current { get; } = new();
        public ApplicationDataContainer LocalSettings { get; } = new();
    }

    public sealed class ApplicationDataContainer
    {
        private readonly Dictionary<string, ApplicationDataContainer> _children = new();
        public IDictionary<string, object> Values { get; } = new Dictionary<string, object>();

        public ApplicationDataContainer CreateContainer(
            string name,
            ApplicationDataCreateDisposition disposition)
        {
            if (!_children.TryGetValue(name, out var child))
            {
                child = new ApplicationDataContainer();
                _children[name] = child;
            }
            return child;
        }
    }
}

namespace Windows.UI.Xaml
{
    public enum Visibility
    {
        Visible,
        Collapsed,
    }

    public enum FocusState
    {
        Programmatic,
    }
}

namespace Windows.UI.Xaml.Controls
{
    public class ContentDialog
    {
    }

    public sealed class ContentDialogButtonClickEventArgs
    {
        public bool Cancel { get; set; }
    }

    public sealed class TextBox
    {
        public string Text { get; set; } = string.Empty;
        public void Focus(FocusState state)
        {
        }
    }

    public sealed class TextBlock
    {
        public string Text { get; set; } = string.Empty;
        public Visibility Visibility { get; set; }
    }
}

namespace Telegram.Controls
{
    public class ContentPopup
    {
        public string PrimaryButtonText { get; set; }
        public string SecondaryButtonText { get; set; }
        public string CloseButtonText { get; set; }
    }
}

namespace Telegram.Crossgram
{
    public sealed partial class ServerConfigurationPopup
    {
        private readonly TextBox ConfigurationInput = new();
        private readonly TextBlock ErrorText = new();

        private void InitializeComponent()
        {
        }
    }
}

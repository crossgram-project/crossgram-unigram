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

    public readonly struct Thickness
    {
        public Thickness(double left, double top, double right, double bottom)
        {
        }
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
        public bool AcceptsReturn { get; set; }
        public TextWrapping TextWrapping { get; set; }
        public bool IsSpellCheckEnabled { get; set; }
        public bool IsTextPredictionEnabled { get; set; }
        public double MinHeight { get; set; }
        public double MaxHeight { get; set; }
        public string PlaceholderText { get; set; } = string.Empty;
        public void Focus(FocusState state)
        {
        }
    }

    public sealed class TextBlock
    {
        public string Text { get; set; } = string.Empty;
        public Visibility Visibility { get; set; }
        public TextWrapping TextWrapping { get; set; }
        public Thickness Margin { get; set; }
    }

    public enum TextWrapping
    {
        NoWrap,
        Wrap,
    }

    public sealed class StackPanel
    {
        public double Width { get; set; }
        public IList<object> Children { get; } = new List<object>();
    }
}

namespace Telegram.Controls
{
    public class ContentPopup
    {
        public string PrimaryButtonText { get; set; }
        public string SecondaryButtonText { get; set; }
        public string CloseButtonText { get; set; }
        public Thickness Padding { get; set; }
        public object Content { get; set; }
        public event System.Action<ContentDialog, ContentDialogButtonClickEventArgs> PrimaryButtonClick;
    }
}

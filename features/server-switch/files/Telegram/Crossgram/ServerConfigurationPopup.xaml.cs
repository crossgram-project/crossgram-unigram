using System;
using Telegram.Controls;
using Windows.UI.Xaml;
using Windows.UI.Xaml.Controls;

namespace Telegram.Crossgram
{
    public sealed partial class ServerConfigurationPopup : ContentPopup
    {
        private TextBox ConfigurationInput;
        private TextBlock ErrorText;

        public ServerConfigurationPopup(string currentConfiguration)
        {
            InitializeComponent();

            ConfigurationInput.Text = currentConfiguration ?? string.Empty;
            PrimaryButtonText = "Apply configuration";
            SecondaryButtonText = "Official Telegram";
            CloseButtonText = "Cancel";
        }

        private void InitializeComponent()
        {
            Padding = new Thickness(24, 12, 24, 24);
            ConfigurationInput = new TextBox
            {
                AcceptsReturn = true,
                TextWrapping = TextWrapping.NoWrap,
                IsSpellCheckEnabled = false,
                IsTextPredictionEnabled = false,
                MinHeight = 300,
                MaxHeight = 460,
                PlaceholderText = "Paste server configuration JSON",
            };
            ErrorText = new TextBlock
            {
                Visibility = Visibility.Collapsed,
                TextWrapping = TextWrapping.Wrap,
                Margin = new Thickness(0, 8, 0, 0),
            };

            var content = new StackPanel { Width = 520 };
            content.Children.Add(new TextBlock
            {
                Text = "Server configuration",
                Margin = new Thickness(0, 0, 0, 8),
            });
            content.Children.Add(new TextBlock
            {
                Text = "Paste Crossgram server JSON. Applying a different server restarts Unigram and uses an isolated TDLib database.",
                TextWrapping = TextWrapping.Wrap,
                Margin = new Thickness(0, 0, 0, 12),
            });
            content.Children.Add(ConfigurationInput);
            content.Children.Add(ErrorText);
            Content = content;
            PrimaryButtonClick += OnPrimaryButtonClick;
        }

        public CrossgramServerConfiguration Configuration { get; private set; }

        private void OnPrimaryButtonClick(ContentDialog sender, ContentDialogButtonClickEventArgs args)
        {
            try
            {
                Configuration = CrossgramServerConfiguration.Parse(ConfigurationInput.Text);
                ErrorText.Visibility = Visibility.Collapsed;
            }
            catch (FormatException error)
            {
                ErrorText.Text = error.Message;
                ErrorText.Visibility = Visibility.Visible;
                args.Cancel = true;
                ConfigurationInput.Focus(FocusState.Programmatic);
            }
        }
    }
}

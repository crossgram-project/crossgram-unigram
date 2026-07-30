using System;
using Telegram.Controls;
using Windows.UI.Xaml;
using Windows.UI.Xaml.Controls;

namespace Telegram.Crossgram
{
    public sealed partial class ServerConfigurationPopup : ContentPopup
    {
        public ServerConfigurationPopup(string currentConfiguration)
        {
            InitializeComponent();

            ConfigurationInput.Text = currentConfiguration ?? string.Empty;
            PrimaryButtonText = "Apply configuration";
            SecondaryButtonText = "Official Telegram";
            CloseButtonText = "Cancel";
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

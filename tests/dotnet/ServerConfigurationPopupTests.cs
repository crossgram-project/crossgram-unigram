using System.Reflection;
using Telegram.Crossgram;
using Windows.UI.Xaml.Controls;
using Xunit;

namespace Crossgram.Unigram.Tests;

public sealed class ServerConfigurationPopupTests
{
    [Fact]
    public void CancelsCloseForInvalidJson()
    {
        var popup = new ServerConfigurationPopup("not-json");
        var args = new ContentDialogButtonClickEventArgs();

        InvokePrimary(popup, args);

        Assert.True(args.Cancel);
        Assert.Null(popup.Configuration);
    }

    [Fact]
    public void AcceptsValidJson()
    {
        var popup = new ServerConfigurationPopup("""
        {
          "name": "Office",
          "host": "127.0.0.1",
          "port": 4430,
          "rsa_key": "-----BEGIN RSA PUBLIC KEY-----\nAQAB\n-----END RSA PUBLIC KEY-----"
        }
        """);
        var args = new ContentDialogButtonClickEventArgs();

        InvokePrimary(popup, args);

        Assert.False(args.Cancel);
        Assert.Equal("Office", popup.Configuration.Name);
    }

    private static void InvokePrimary(
        ServerConfigurationPopup popup,
        ContentDialogButtonClickEventArgs args)
    {
        var method = typeof(ServerConfigurationPopup).GetMethod(
            "OnPrimaryButtonClick",
            BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(method);
        method.Invoke(popup, new object[] { new ContentDialog(), args });
    }
}

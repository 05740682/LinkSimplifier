using System.Net;
using System.Windows;

namespace LinkSimplifier
{
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12 | SecurityProtocolType.Tls13;
            base.OnStartup(e);
            var mainWindow = new MainWindow();
            mainWindow.Show();
        }

        protected override void OnExit(ExitEventArgs e)
        {
            HttpClientWrapper.Dispose();
            base.OnExit(e);
        }
    }
}

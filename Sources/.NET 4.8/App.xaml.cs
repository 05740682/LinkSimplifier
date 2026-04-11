using LinkSimplifier.Services;
using LinkSimplifier.Services.Network;
using System;
using System.Net;
using System.Threading.Tasks;
using System.Windows;

namespace LinkSimplifier
{
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            DebugLogger.Write("=== Start ===");

            DispatcherUnhandledException += (s, a) => { DebugLogger.Write($"[UI] {a.Exception}", 4); a.Handled = true; };
            TaskScheduler.UnobservedTaskException += (s, a) => { DebugLogger.Write($"[Task] {a.Exception}", 4); a.SetObserved(); };
            AppDomain.CurrentDomain.UnhandledException += (s, a) => DebugLogger.Write(a.ExceptionObject?.ToString(), 4);

            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12 | SecurityProtocolType.Tls13;
            base.OnStartup(e);

            var mainWindow = new MainWindow();
            mainWindow.Show();
        }

        protected override void OnExit(ExitEventArgs e)
        {
            DebugLogger.Write("=== End ===");
            HttpClientWrapper.Dispose();
            base.OnExit(e);
        }
    }
}
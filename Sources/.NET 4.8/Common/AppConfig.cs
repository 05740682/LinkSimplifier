using System;
using System.IO;

namespace LinkSimplifier.Common
{
    internal static class AppConfig
    {
        internal static string TempPath => Path.GetTempPath();
        internal static string BaseDirectory => AppDomain.CurrentDomain.BaseDirectory;
        internal static string LocalAppData => Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
    }
}

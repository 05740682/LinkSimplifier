using LinkSimplifier.Common;
using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Management;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;

namespace LinkSimplifier.Services
{
    internal static class DebugLogger
    {
        private static readonly string[] L = { "TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL" };

        static DebugLogger()
        {
            try
            {
                var path = Path.Combine(AppConfig.BaseDirectory, "debug.log");
                var fs = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.ReadWrite);
                var sw = new StreamWriter(fs, Encoding.UTF8) { AutoFlush = true };

                Trace.Listeners.Clear();
                Trace.Listeners.Add(new TextWriterTraceListener(sw));

                Task.Run(() => LogHardware());
                Write("Log system initialized.");
            }
            catch { }
        }

        private static void LogHardware()
        {
            try
            {
                string cpu = Get("Win32_Processor", "Name");
                string gpu = GetGpu();
                string ramRaw = Get("Win32_ComputerSystem", "TotalPhysicalMemory");
                string ram = ulong.TryParse(ramRaw, out ulong b) ? ((b + 536870912) >> 30) + " GB" : "N/A";
                string os = $"{Get("Win32_OperatingSystem", "Caption")} ({Get("Win32_OperatingSystem", "Version")}) {(Environment.Is64BitOperatingSystem ? "64-bit" : "32-bit")}";

                Write(new string('-', 60));
                Write($"CPU         {cpu?.Trim()}");
                Write($"GPU         {gpu}");
                Write($"RAM         {ram}");
                Write($"OS          {os}");
                Write(RuntimeInformation.FrameworkDescription);
                Write(new string('-', 60));
            }
            catch { }
        }

        static string Get(string table, string property)
        {
            try
            {
                using (var searcher = new ManagementObjectSearcher($"SELECT {property} FROM {table}"))
                using (var collection = searcher.Get())
                {
                    foreach (var obj in collection)
                    {
                        var val = obj[property]?.ToString();
                        if (!string.IsNullOrEmpty(val)) return val;
                    }
                }
            }
            catch { }
            return "Unknown";
        }

        static string GetGpu()
        {
            try
            {
                using (var searcher = new ManagementObjectSearcher("SELECT Name FROM Win32_VideoController"))
                using (var collection = searcher.Get())
                {
                    var names = collection.Cast<ManagementBaseObject>()
                                          .Select(x => x["Name"]?.ToString())
                                          .Where(s => !string.IsNullOrEmpty(s));
                    return names.Any() ? string.Join(" / ", names) : "Unknown";
                }
            }
            catch { return "Unknown"; }
        }

        internal static void Write(string msg, int i = 1)
        {
            int idx = (i < 0 || i >= L.Length) ? 1 : i;
            string prefix = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}][{L[idx]}] ";
            string formattedMsg = msg.Replace("\n", "\n" + prefix);
            Trace.WriteLine(prefix + formattedMsg);
        }
    }

}

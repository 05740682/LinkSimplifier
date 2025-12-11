using System;
using System.Threading.Tasks;

namespace LinkSimplifier
{
    internal static class DebugLogger
    {
        internal static async Task WriteLogAsync(string message)
        {
            await Console.Out.WriteLineAsync($"[Debug][{DateTime.Now:HH:mm:ss.fff}] {message}");
        }
    }
}
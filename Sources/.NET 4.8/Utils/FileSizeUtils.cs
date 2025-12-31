using System;

namespace LinkSimplifier
{
    internal static class FileSizeUtils
    {
        private static readonly string[] SizeSuffixes = { "B", "KB", "MB", "GB", "TB" };
        internal static string FormatBytes(long bytes)
        {
            if (bytes == 0) return "0 B";

            int unitIndex = (int)(Math.Log(bytes) / Math.Log(1024));
            unitIndex = Math.Min(unitIndex, SizeSuffixes.Length - 1);

            double size = bytes / Math.Pow(1024, unitIndex);
            return $"{size:0.##} {SizeSuffixes[unitIndex]}";
        }
    }
}

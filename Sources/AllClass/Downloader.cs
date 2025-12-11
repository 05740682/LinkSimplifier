using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace LinkSimplifier
{
    internal static class Downloader
    {
        internal static async Task<string> DownloadStringAsync(string url)
        {
            return await HttpClientWrapper.SendRequestAsync(url, HttpUtils.GetStringFromResponse);
        }

        internal static async Task<bool> DownloadFileAsync(string url, string saveDirectory, IProgress<(double percentage, long bytesReceived, long? totalBytes)> progress = null, CancellationToken ct = default)
        {
            string tempFilePath = null;

            try
            {
                return await HttpClientWrapper.SendRequestAsync(url, async response =>
                {
                    response.EnsureSuccessStatusCode();

                    string fileName = HttpUtils.GetFileNameFromHeaders(response.Content.Headers);
                    long? fileSize = response.Content.Headers.ContentLength;
                    string finalFilePath = Path.Combine(saveDirectory, fileName);
                    tempFilePath = finalFilePath + ".tmp";

                    int bufferSize = fileSize.HasValue && fileSize > 100 * 1024 ? (
                    fileSize <= 5 * 1024 * 1024 ? 16384 : 
                    fileSize <= 50 * 1024 * 1024 ? 65536 :
                    fileSize <= 500 * 1024 * 1024 ? 262144 : 524288) 
                    : 4096;

                    Directory.CreateDirectory(saveDirectory);

                    using (var contentStream = await response.Content.ReadAsStreamAsync())
                    using (var fileStream = new FileStream(tempFilePath, FileMode.Create, FileAccess.Write, FileShare.None, bufferSize, FileOptions.Asynchronous | FileOptions.SequentialScan))
                    {
                        var buffer = new byte[bufferSize];
                        long totalBytesReceived = 0;
                        long lastReportedBytes = 0;
                        var reportTimer = Stopwatch.StartNew();

                        int bytesRead;
                        while ((bytesRead = await contentStream.ReadAsync(buffer, 0, buffer.Length, ct)) > 0)
                        {
                            ct.ThrowIfCancellationRequested();
                            await fileStream.WriteAsync(buffer, 0, bytesRead, ct);
                            totalBytesReceived += bytesRead;

                            if (totalBytesReceived - lastReportedBytes >= 1024 * 1024 && reportTimer.ElapsedMilliseconds >= 200)
                            {
                                double percentage = fileSize.HasValue && fileSize > 0 ? (double)totalBytesReceived / fileSize.Value * 100 : 0;
                                progress?.Report((percentage, totalBytesReceived, fileSize));

                                lastReportedBytes = totalBytesReceived;
                                reportTimer.Restart();
                            }
                        }

                        progress?.Report((100, totalBytesReceived, fileSize));
                    }
                    if (File.Exists(finalFilePath)) File.Delete(finalFilePath);
                    File.Move(tempFilePath, finalFilePath);

                    return true;
                }, ct: ct);
            }
            catch
            {
                if (tempFilePath != null && File.Exists(tempFilePath)) File.Delete(tempFilePath);
                throw;
            }
        }
    
    }
}
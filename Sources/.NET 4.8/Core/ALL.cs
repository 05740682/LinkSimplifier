using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Web;
using System.Web.Script.Serialization;

namespace LinkSimplifier
{
    internal static class DebugLogger
    {
        internal static async Task WriteLogAsync(string message)
        {
            await Console.Out.WriteLineAsync($"[Debug][{DateTime.Now:HH:mm:ss.fff}] {message}");
        }
    }

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

    internal class Globals
    {
        internal static readonly Random RandomInstance = new Random();

        internal static readonly Regex ContentDispositionFilenameRegex = new Regex(@"filename\*=(?:([^'']*)'')?([^;]+)", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        internal static readonly Regex FolderParamRegex = new Regex(@"&folder", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        internal static readonly Regex HttpProtocolRegex = new Regex(@"^https?://", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        internal static readonly Regex IframeSrcRegex = new Regex(@"<iframe[^>]*?src\s*=\s*[""']?([^""'\s>]*)", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        internal static readonly Regex PasswordParamRegex = new Regex(@"&pwd=(.*)", RegexOptions.Compiled | RegexOptions.IgnoreCase);

        internal static readonly Regex JavaScriptAjaxUrlRegex = new Regex(@"url\s*:\s*'([^']*)'", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        internal static readonly Regex JavaScriptAjaxDataRegex = new Regex(@"data\s*:\s*\{\s*([^}]+)\s*\}", RegexOptions.Compiled | RegexOptions.Singleline | RegexOptions.IgnoreCase);
        internal static readonly Regex JavaScriptCommentRegex = new Regex(@"(//[^\r\n]*|/\*[\s\S]*?\*/)(?=([^""'`]*(?:""[^""\\]*(?:\\.[^""\\]*)*""|'[^'\\]*(?:\\.[^'\\]*)*'|`[^`\\]*(?:\\.[^`\\]*)*`))*[^""'`]*$)", RegexOptions.Compiled | RegexOptions.Multiline);
        internal static readonly Regex JavaScriptVarRegex = new Regex(@"var\s+(\w+)(?:\s*=\s*([^;]+))?;", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        internal static readonly Regex JavaScriptAssignRegex = new Regex(@"(\w+)\s*=\s*([^;]+);", RegexOptions.Compiled | RegexOptions.IgnoreCase);

        internal static readonly Regex AcwScV2ArgRegex = new Regex(@"var arg1='([^']+)'", RegexOptions.Compiled | RegexOptions.IgnoreCase);

        internal static readonly string[] Paths = { Path.GetTempPath(), AppDomain.CurrentDomain.BaseDirectory, Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData) };
    }

    internal class RequestHeaders
    {
        internal static string Accept = "*/*";
        internal static string AcceptLanguage = "zh-CN,zh;q=0.9";
        internal static string UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/999.0.0.0 Safari/537.36";
    }

    internal static class HttpClientWrapper
    {
        internal static HttpClient Client => _client;
        internal static CookieContainer CookieContainer => _handler.CookieContainer;

        private static readonly HttpClient _client;
        private static readonly HttpClientHandler _handler;
        private static bool _disposed = false;

        static HttpClientWrapper()
        {
            _handler = new HttpClientHandler
            {
                AllowAutoRedirect = false,
                AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate,
                CookieContainer = new CookieContainer(),
                UseCookies = true,
                UseProxy = false,
            };
            _client = new HttpClient(_handler) { Timeout = Timeout.InfiniteTimeSpan };
            _client.DefaultRequestHeaders.Accept.ParseAdd(RequestHeaders.Accept);
            _client.DefaultRequestHeaders.AcceptLanguage.ParseAdd(RequestHeaders.AcceptLanguage);
            _client.DefaultRequestHeaders.UserAgent.ParseAdd(RequestHeaders.UserAgent);
        }

        internal static async Task<T> SendRequestAsync<T>(string url, Func<HttpResponseMessage, Task<T>> processResponse, HttpMethod method = null, Action<HttpRequestMessage> configureRequest = null, CancellationToken ct = default)
        {
            using (var request = new HttpRequestMessage(method ?? HttpMethod.Get, url))
            {
                configureRequest?.Invoke(request);
                using (var response = await _client.SendAsync(request, (request.Method == HttpMethod.Get || request.Method == HttpMethod.Head) ? HttpCompletionOption.ResponseHeadersRead : HttpCompletionOption.ResponseContentRead, ct))
                {
                    return await processResponse(response);
                }
            }
        }

        internal static void Dispose()
        {
            if (_disposed) return;
            _client?.Dispose();
            _disposed = true;
        }
    }

    internal static class HttpUtils
    {
        internal static Func<HttpResponseMessage, Task<string>> GetStringFromResponse = async response =>
        {
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadAsStringAsync();
        };

        internal static Action<HttpRequestMessage> SetFormContent(IEnumerable<KeyValuePair<string, string>> formData, string referrer = null)
        {
            return request =>
            {
                request.Content = new FormUrlEncodedContent(formData);
                if (!string.IsNullOrEmpty(referrer))
                {
                    request.Headers.Referrer = new Uri(referrer);
                }
            };
        }

        internal static async Task<string> GetLocationFromUrlAsync(string url)
        {
            return await HttpClientWrapper.SendRequestAsync(url, async response =>
            {
                if ((int)response.StatusCode >= 300 && (int)response.StatusCode <= 399)
                {
                    return await Task.FromResult(response.Headers.Location?.ToString());
                }
                return await Task.FromResult<string>(null);
            }, HttpMethod.Head);
        }

        internal static string GetFileNameFromHeaders(HttpContentHeaders contentHeaders)
        {
            try
            {
                if (contentHeaders.TryGetValues("Content-Disposition", out var values))
                {
                    var match = Globals.ContentDispositionFilenameRegex.Match(values.FirstOrDefault() ?? "");
                    if (match.Success) { return Uri.UnescapeDataString(match.Groups[2].Value); }
                }
            }
            catch { }
            return Guid.NewGuid().ToString("N");
        }
    }

    internal class Json
    {
        private static readonly JavaScriptSerializer Serializer = new JavaScriptSerializer();

        internal static object DeserializeObject(string jsonText)
        {
            return Serializer.DeserializeObject(jsonText);
        }

        internal static string SerializeObject(object obj)
        {
            return Serializer.Serialize(obj);
        }
    }

    internal class Lanzou
    {
        private static string CalculateAcwScV2(string arg1)
        {
            int[] p = { 15, 35, 29, 24, 33, 16, 1, 38, 10, 9, 19, 31, 40, 27, 22, 23, 25, 13, 6, 11, 39, 18, 20, 8, 14, 21, 32, 26, 2, 30, 7, 4, 17, 5, 3, 28, 34, 37, 12, 36 };
            string m = "3000176000856006061501533003690027800375";

            char[] b = new char[40];
            for (int i = 0; i < 40; i++)
                for (int j = 0; j < 40; j++)
                    if (p[j] == i + 1)
                        b[j] = arg1[i];

            StringBuilder sb = new StringBuilder(40);
            for (int i = 0; i < 40; i += 2)
            {
                int v1 = Convert.ToInt32(new string(b, i, 2), 16);
                int v2 = Convert.ToInt32(m.Substring(i, 2), 16);
                sb.Append((v1 ^ v2).ToString("X2"));
            }

            return sb.ToString().ToLower();
        }

        private static async Task ProcessAcwScV2Challenge(Uri domain, string url)
        {
            await DebugLogger.WriteLogAsync($"开始处理acw_sc__v2挑战: {url}");

            var html = await Downloader.DownloadStringAsync(url);

            var _m = Globals.AcwScV2ArgRegex.Match(html);
            if (_m.Success)
            {
                await DebugLogger.WriteLogAsync($"找到acw_sc__v2参数: {_m.Groups[1].Value}");
                var cookieValue = CalculateAcwScV2(_m.Groups[1].Value);
                await DebugLogger.WriteLogAsync($"计算得到cookie值: {cookieValue}");
                HttpClientWrapper.CookieContainer.Add(domain, new Cookie("acw_sc__v2", cookieValue));
            }
        }

        /// <summary>
        /// 从HTML提取AJAX数据（返回URL和表单数据）
        /// </summary>
        private static async Task<(string PostUrl, Dictionary<string, string> FormData)> ExtractAjaxDataAsync(string cleanHtml, string domain, string password = null)
        {
            var vars = new Dictionary<string, string>();
            Globals.JavaScriptVarRegex.Matches(cleanHtml).Cast<Match>().ToList().ForEach(m => vars[m.Groups[1].Value] = m.Groups[2].Success ? m.Groups[2].Value.Trim().Trim('\'') : "");
            Globals.JavaScriptAssignRegex.Matches(cleanHtml).Cast<Match>().Where(m => vars.ContainsKey(m.Groups[1].Value)).ToList().ForEach(m => vars[m.Groups[1].Value] = m.Groups[2].Value.Trim().Trim('\''));
            vars["pwd"] = password ?? "";

            await DebugLogger.WriteLogAsync($"提取到变量: {vars.Count} 个");

            var ajaxData = Regex.Replace(Globals.JavaScriptAjaxDataRegex.Match(cleanHtml).Groups[1].Value, @"\s+", " ").Trim();
            await DebugLogger.WriteLogAsync($"原始AJAX数据: {ajaxData}");

            var formData = ajaxData.Split(',').Select(p => p.Split(':')).Where(parts => parts.Length == 2).ToDictionary(parts => parts[0].Trim().Trim('\'', '"'), parts => parts[1].Trim().Trim('\'', '"'));
            await DebugLogger.WriteLogAsync($"构造表单数据: {formData.Count} 个字段");

            foreach (var key in formData.Keys.ToList())
                if (vars.TryGetValue(formData[key], out var newValue))
                    (formData[key], _) = (newValue, DebugLogger.WriteLogAsync($"{key}: 替换 {formData[key]} -> {newValue}"));

            var postUrl = domain + Globals.JavaScriptAjaxUrlRegex.Match(cleanHtml).Groups[1].Value;
            await DebugLogger.WriteLogAsync($"AJAX请求URL: {postUrl}");
            return (postUrl, formData);
        }

        internal static async Task<string> GetDownloadLinkAsync(string url, string password = null)
        {
            await DebugLogger.WriteLogAsync($"开始获取下载链接: {url}, 密码: {password ?? "无"}");

            var uri = new Uri(url);
            var domain = uri.GetLeftPart(UriPartial.Authority);
            await DebugLogger.WriteLogAsync($"域名: {domain}");
            await ProcessAcwScV2Challenge(new Uri(domain), url);

            var html = await Downloader.DownloadStringAsync(url);

            var referrer = url;

            if (string.IsNullOrEmpty(password))
            {
                await DebugLogger.WriteLogAsync("无密码，检查iframe");
                var iframeMatch = Globals.IframeSrcRegex.Match(html);
                if (iframeMatch.Success)
                {
                    referrer = domain + iframeMatch.Groups[1].Value;
                    await DebugLogger.WriteLogAsync($"找到iframe，跳转到: {referrer}");
                    html = await Downloader.DownloadStringAsync(referrer);
                }
            }

            var cleanHtml = Globals.JavaScriptCommentRegex.Replace(html, "");

            var (postUrl, formData) = await ExtractAjaxDataAsync(cleanHtml, domain, password);

            var jsonResponse = await HttpClientWrapper.SendRequestAsync(postUrl, HttpUtils.GetStringFromResponse, HttpMethod.Post, HttpUtils.SetFormContent(formData, referrer));
            await DebugLogger.WriteLogAsync($"收到JSON响应: {jsonResponse}");

            dynamic response = Json.DeserializeObject(jsonResponse);
            string resultCode = $"{response["zt"]}";
            await DebugLogger.WriteLogAsync($"状态响应代码: {resultCode}");

            if (resultCode == "1")
            {
                string downloadUrl = $"{response["dom"]}/file/{response["url"]}";
                await DebugLogger.WriteLogAsync($"获取下载链接: {downloadUrl}");

                string finalUrl = await HttpUtils.GetLocationFromUrlAsync(downloadUrl);
                await DebugLogger.WriteLogAsync($"最终下载链接: {finalUrl}");

                return finalUrl;
            }
            else
            {
                string errorMsg = $"错误：{response["inf"]}";
                await DebugLogger.WriteLogAsync(errorMsg);
                return errorMsg;
            }
        }

        internal static async Task<string> GetShareLinksFromFolder(string url, string password = null)
        {
            await DebugLogger.WriteLogAsync($"开始获取文件夹分享链接: {url}, 密码: {password ?? "无"}");

            var uri = new Uri(url);
            var domain = uri.GetLeftPart(UriPartial.Authority);
            await DebugLogger.WriteLogAsync($"域名: {domain}");
            await ProcessAcwScV2Challenge(new Uri(domain), url);

            var html = await Downloader.DownloadStringAsync(url);

            var referrer = url;
            var cleanHtml = Globals.JavaScriptCommentRegex.Replace(html, "");

            var (postUrl, formData) = await ExtractAjaxDataAsync(cleanHtml, domain, password);

            bool lastPage = false;
            StringBuilder files = new StringBuilder();
            int currentPage = int.Parse(formData["pg"]);
            int totalFiles = 0;

            do
            {
                await DebugLogger.WriteLogAsync($"开始处理第 {currentPage} 页");

                var jsonResponse = await HttpClientWrapper.SendRequestAsync(postUrl, HttpUtils.GetStringFromResponse, HttpMethod.Post, HttpUtils.SetFormContent(formData, referrer));
                await DebugLogger.WriteLogAsync($"收到第 {currentPage} 页响应，内容: {jsonResponse}");

                dynamic response = Json.DeserializeObject(jsonResponse);
                string resultCode = $"{response["zt"]}";
                await DebugLogger.WriteLogAsync($"状态响应代码: {resultCode}");
                if (resultCode == "1")
                {
                    int fileCount = ((response["text"] as object[])?.Length) ?? ((response["text"] as List<object>)?.Count ?? 0);
                    await DebugLogger.WriteLogAsync($"第 {currentPage} 页文件数量: {fileCount}");

                    for (int i = 0; i < fileCount; i++)
                    {
                        var file = response["text"][i];
                        string fileName = file["name_all"];
                        string fileSize = file["size"];
                        string uploadTime = file["time"];
                        string fileUrl = $"{domain}/{file["id"]}";

                        files.Append($"文件名：{fileName}\n大小：{fileSize}\n上传时间：{uploadTime}\n链接：{fileUrl}\n\n----------------------------------------------------\n\n");
                        totalFiles++;
                    }

                    await DebugLogger.WriteLogAsync($"已添加 {fileCount} 个文件");

                    if ((fileCount > 0 && fileCount < 50) || currentPage >= 2)
                    {
                        lastPage = true;
                        files.Append("\n【提示】 请勿滥用此功能，最多显示前100个文件列表\n");
                    }
                    else
                    {
                        currentPage++;
                        formData["pg"] = currentPage.ToString();
                        await DebugLogger.WriteLogAsync($"跳转到下一页: {currentPage}");
                        await Task.Delay(3000);
                    }
                }
                else
                {
                    string errorMsg = $"错误：{response["info"]}";
                    await DebugLogger.WriteLogAsync(errorMsg);
                    return errorMsg;
                }

            } while (!lastPage);

            await DebugLogger.WriteLogAsync($"文件夹获取完成，总共 {totalFiles} 个文件");
            return files.ToString();
        }
    }

    internal static class QQMail
    {
        internal static async Task<string> GetDownloadLinkAsync(string url)
        {
            var uri = new Uri(url);
            var query = HttpUtility.ParseQueryString(uri.Query);

            if (query["key"] is string key && query["code"] is string code)
            {
                return await HttpUtils.GetLocationFromUrlAsync(
                    $"https://wx.mail.qq.com/ftn/download?func=4&key={key}&code={code}"
                );
            }

            var formData = new[] { new KeyValuePair<string, string>("f", "json") };
            var r = $"{(long)(Globals.RandomInstance.NextDouble() * 1e13)}{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
            var referrer = uri.GetLeftPart(UriPartial.Authority);
            var jsonResponse = await HttpClientWrapper.SendRequestAsync(
                $"{url}&r={r}&sid=", HttpUtils.GetStringFromResponse, HttpMethod.Post, HttpUtils.SetFormContent(formData, referrer)
            );
            var downloadUrl = ((dynamic)Json.DeserializeObject(jsonResponse))["body"]["url"];
            return await HttpUtils.GetLocationFromUrlAsync(downloadUrl);
        }
    }

    internal static class UrlProcessor
    {
        internal static async Task<string> ProcessUrlAsync(string url)
        {
            if (string.IsNullOrWhiteSpace(url) || !Globals.HttpProtocolRegex.IsMatch(url))
                throw new ArgumentException("无效的URL地址");

            try
            {
                var host = new Uri(url).Host;
                if (host.Contains("mail.qq")) return await ProcessQQMailUrlAsync(url);
                if (host.Contains("lanzou")) return await ProcessLanZouUrlAsync(url);
                return url;
            }
            catch (UriFormatException)
            {
                throw new ArgumentException("URL格式错误");
            }
        }

        private static async Task<string> ProcessQQMailUrlAsync(string url)
        {
            return await QQMail.GetDownloadLinkAsync(url);
        }

        private static async Task<string> ProcessLanZouUrlAsync(string url)
        {
            var (isFolder, password, baseUrl) = ExtractUrlParameters(url);
            if (!isFolder)
            {
                return await Lanzou.GetDownloadLinkAsync(baseUrl, password);
            }
            return await Lanzou.GetShareLinksFromFolder(baseUrl, password);
        }

        private static (bool isFolder, string password, string baseUrl) ExtractUrlParameters(string url)
        {
            bool isFolder = Globals.FolderParamRegex.IsMatch(url);
            string processedUrl = isFolder ? Globals.FolderParamRegex.Replace(url, "") : url;
            return (isFolder, Globals.PasswordParamRegex.Match(processedUrl).Groups[1].Value, Globals.PasswordParamRegex.Replace(processedUrl, ""));
        }
    }

}
